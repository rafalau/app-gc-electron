#include <X11/Xlib.h>
#include <vlc/libvlc.h>
#include <vlc/libvlc_media.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct libvlc_renderer_item_t libvlc_renderer_item_t;
#ifdef __cplusplus
}
#endif
#include <vlc/libvlc_media_player.h>

#include <atomic>
#include <chrono>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace {

struct AppState {
  Display* display = nullptr;
  ::Window parent = 0;
  ::Window child = 0;
  libvlc_instance_t* vlc = nullptr;
  libvlc_media_player_t* player = nullptr;
  bool visible = false;
  int x = 0;
  int y = 0;
  int width = 640;
  int height = 360;
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

bool init_vlc(AppState& state) {
  const char* args[] = {
    "--quiet",
    "--no-video-title-show",
    "--network-caching=300",
    "--live-caching=300",
    "--intf=dummy",
    "--vout=xcb_xv"
  };

  state.vlc = libvlc_new(sizeof(args) / sizeof(args[0]), args);
  if (!state.vlc) {
    std::cerr << "ERRO: nao foi possivel inicializar o libVLC" << std::endl;
    return false;
  }

  state.player = libvlc_media_player_new(state.vlc);
  if (!state.player) {
    std::cerr << "ERRO: nao foi possivel criar o media player do libVLC" << std::endl;
    return false;
  }

  libvlc_media_player_set_xwindow(state.player, state.child);
  libvlc_video_set_aspect_ratio(state.player, "16:9");
  libvlc_video_set_scale(state.player, 0);
  libvlc_video_set_crop_geometry(state.player, "16:9");
  libvlc_audio_set_volume(state.player, 100);
  return true;
}

void stop_media(AppState& state) {
  if (!state.player) return;
  libvlc_media_player_stop(state.player);
}

void play_media(AppState& state, const std::string& url) {
  if (!state.player || !state.vlc) return;

  libvlc_media_t* media = libvlc_media_new_location(state.vlc, url.c_str());
  if (!media) {
    std::cerr << "ERRO: nao foi possivel criar a media do libVLC" << std::endl;
    return;
  }

  libvlc_media_player_set_media(state.player, media);
  libvlc_media_release(media);
  libvlc_media_player_play(state.player);
}

void cleanup(AppState& state) {
  stop_media(state);

  if (state.player) {
    libvlc_media_player_release(state.player);
    state.player = nullptr;
  }

  if (state.vlc) {
    libvlc_release(state.vlc);
    state.vlc = nullptr;
  }

  if (state.display && state.child) {
    XDestroyWindow(state.display, state.child);
    state.child = 0;
  }

  if (state.display) {
    XCloseDisplay(state.display);
    state.display = nullptr;
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
      state.visible = true;
      sync_window(state);
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
    libvlc_audio_set_mute(state.player, value != 0 ? 1 : 0);
    return;
  }

  if (cmd == "VOLUME") {
    int value = 100;
    iss >> value;
    if (value < 0) value = 0;
    if (value > 200) value = 200;
    libvlc_audio_set_volume(state.player, value);
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
  if (!init_vlc(state)) {
    cleanup(state);
    return 1;
  }

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

    std::this_thread::sleep_for(std::chrono::milliseconds(16));
  }

  cleanup(state);

  if (input_thread.joinable()) {
    input_thread.join();
  }

  return 0;
}
