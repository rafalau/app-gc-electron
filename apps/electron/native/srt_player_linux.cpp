#include <X11/Xlib.h>

#include <atomic>
#include <chrono>
#include <csignal>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <fcntl.h>

namespace {

struct AppState {
  Display* display = nullptr;
  ::Window parent = 0;
  ::Window child = 0;
  bool visible = false;
  int x = 0;
  int y = 0;
  int width = 640;
  int height = 360;
  int volume = 100;
  bool muted = false;
  pid_t mpv_pid = -1;
};

std::atomic<bool> g_running(true);

void sync_window(AppState& state) {
  if (!state.display || !state.child) return;

  XMoveResizeWindow(state.display, state.child, state.x, state.y, state.width, state.height);

  if (state.visible) {
    XMapRaised(state.display, state.child);
  } else {
    XUnmapWindow(state.display, state.child);
  }

  XFlush(state.display);
}

bool init_x11(AppState& state, unsigned long parent_id) {
  state.display = XOpenDisplay(nullptr);
  if (!state.display) {
    std::cerr << "ERRO: nao foi possivel abrir o display X11" << std::endl;
    return false;
  }

  state.parent = static_cast<::Window>(parent_id);
  int screen = DefaultScreen(state.display);

  state.child = XCreateSimpleWindow(
    state.display,
    state.parent,
    state.x,
    state.y,
    static_cast<unsigned int>(state.width),
    static_cast<unsigned int>(state.height),
    0,
    BlackPixel(state.display, screen),
    BlackPixel(state.display, screen));

  XSelectInput(state.display, state.child, ExposureMask | StructureNotifyMask);
  XFlush(state.display);
  return true;
}

void stop_media(AppState& state) {
  if (state.mpv_pid <= 0) return;

  kill(state.mpv_pid, SIGTERM);
  waitpid(state.mpv_pid, nullptr, 0);
  state.mpv_pid = -1;
}

void play_media(AppState& state, const std::string& url) {
  stop_media(state);

  state.visible = true;
  sync_window(state);

  pid_t pid = fork();
  if (pid < 0) {
    std::cerr << "ERRO: nao foi possivel iniciar o mpv" << std::endl;
    return;
  }

  if (pid == 0) {
    const int null_fd = open("/dev/null", O_WRONLY);
    if (null_fd >= 0) {
      dup2(null_fd, STDOUT_FILENO);
      dup2(null_fd, STDERR_FILENO);
      close(null_fd);
    }

    const std::string wid = std::to_string(static_cast<unsigned long>(state.child));
    const std::string volume = std::to_string(state.volume);
    const char* mute = state.muted ? "yes" : "no";

    execlp(
      "mpv",
      "mpv",
      "--no-config",
      "--force-window=yes",
      "--idle=no",
      "--keep-open=no",
      "--osc=no",
      "--osd-level=0",
      "--msg-level=all=no",
      "--terminal=no",
      "--input-default-bindings=no",
      "--input-vo-keyboard=no",
      "--hwdec=no",
      "--profile=sw-fast",
      "--video-sync=display-resample",
      "--audio-display=no",
      "--cache=yes",
      "--demuxer-max-back-bytes=50MiB",
      "--demuxer-max-bytes=50MiB",
      ("--wid=" + wid).c_str(),
      ("--volume=" + volume).c_str(),
      ("--mute=" + std::string(mute)).c_str(),
      url.c_str(),
      static_cast<char*>(nullptr));

    _exit(1);
  }

  state.mpv_pid = pid;
}

void cleanup(AppState& state) {
  stop_media(state);

  if (state.display && state.child) {
    XDestroyWindow(state.display, state.child);
    state.child = 0;
  }

  if (state.display) {
    XCloseDisplay(state.display);
    state.display = nullptr;
  }
}

void reap_child_if_needed(AppState& state) {
  if (state.mpv_pid <= 0) return;

  int status = 0;
  pid_t result = waitpid(state.mpv_pid, &status, WNOHANG);
  if (result == state.mpv_pid) {
    state.mpv_pid = -1;
  }
}

void handle_command(AppState& state, const std::string& line) {
  std::istringstream iss(line);
  std::string cmd;
  iss >> cmd;

  if (cmd == "PLAY") {
    std::string url;
    iss >> url;
    if (!url.empty()) {
      play_media(state, url);
    }
    return;
  }

  if (cmd == "STOP") {
    stop_media(state);
    return;
  }

  if (cmd == "VISIBLE") {
    int value = 0;
    iss >> value;
    state.visible = value != 0;
    if (!state.visible) {
      stop_media(state);
    }
    sync_window(state);
    return;
  }

  if (cmd == "BOUNDS") {
    iss >> state.x >> state.y >> state.width >> state.height;
    if (state.width < 1) state.width = 1;
    if (state.height < 1) state.height = 1;
    sync_window(state);
    return;
  }

  if (cmd == "MUTE") {
    int value = 0;
    iss >> value;
    state.muted = value != 0;
    return;
  }

  if (cmd == "VOLUME") {
    int value = 100;
    iss >> value;
    if (value < 0) value = 0;
    if (value > 200) value = 200;
    state.volume = value;
    return;
  }

  if (cmd == "QUIT") {
    g_running = false;
  }
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::cerr << "ERRO: parent window id ausente" << std::endl;
    return 1;
  }

  unsigned long parent_id = std::strtoul(argv[1], nullptr, 16);
  AppState state;

  if (!init_x11(state, parent_id)) return 1;

  std::thread input_thread([&state]() {
    std::string line;
    while (g_running && std::getline(std::cin, line)) {
      handle_command(state, line);
    }
    g_running = false;
  });

  while (g_running) {
    while (state.display && XPending(state.display) > 0) {
      XEvent event;
      XNextEvent(state.display, &event);
    }

    reap_child_if_needed(state);
    std::this_thread::sleep_for(std::chrono::milliseconds(16));
  }

  cleanup(state);

  if (input_thread.joinable()) {
    input_thread.join();
  }

  return 0;
}
