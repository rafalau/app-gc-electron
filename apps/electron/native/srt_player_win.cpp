#include <windows.h>

#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace {

struct AppState {
  HWND parent = nullptr;
  HWND child = nullptr;
  bool visible = false;
  int x = 0;
  int y = 0;
  int width = 640;
  int height = 360;
  int volume = 100;
  bool muted = false;
  PROCESS_INFORMATION mpv_process{};
  bool mpv_running = false;
};

std::atomic<bool> g_running(true);

std::wstring utf8_to_wide(const std::string& value) {
  if (value.empty()) return {};

  const int size = MultiByteToWideChar(CP_UTF8, 0, value.c_str(), -1, nullptr, 0);
  if (size <= 0) return {};

  std::wstring wide(static_cast<size_t>(size - 1), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.c_str(), -1, wide.data(), size);
  return wide;
}

void sync_window(const AppState& state) {
  if (!state.child) return;

  SetWindowPos(
    state.child,
    nullptr,
    state.x,
    state.y,
    state.width,
    state.height,
    SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER);

  ShowWindow(state.child, state.visible ? SW_SHOW : SW_HIDE);
  UpdateWindow(state.child);
}

bool init_win32(AppState& state, std::uint64_t parent_id) {
  state.parent = reinterpret_cast<HWND>(static_cast<UINT_PTR>(parent_id));
  if (!IsWindow(state.parent)) {
    std::cerr << "ERRO: janela pai invalida" << std::endl;
    return false;
  }

  state.child = CreateWindowExW(
    0,
    L"STATIC",
    L"",
    WS_CHILD | WS_VISIBLE | SS_BLACKRECT,
    state.x,
    state.y,
    state.width,
    state.height,
    state.parent,
    nullptr,
    GetModuleHandleW(nullptr),
    nullptr);

  if (!state.child) {
    std::cerr << "ERRO: nao foi possivel criar a janela filha" << std::endl;
    return false;
  }

  return true;
}

void stop_media(AppState& state) {
  if (!state.mpv_running) return;

  TerminateProcess(state.mpv_process.hProcess, 0);
  WaitForSingleObject(state.mpv_process.hProcess, 3000);
  CloseHandle(state.mpv_process.hThread);
  CloseHandle(state.mpv_process.hProcess);
  state.mpv_process = {};
  state.mpv_running = false;
}

void play_media(AppState& state, const std::string& url) {
  stop_media(state);

  state.visible = true;
  sync_window(state);

  SECURITY_ATTRIBUTES sa{};
  sa.nLength = sizeof(sa);
  sa.bInheritHandle = TRUE;

  HANDLE null_handle = CreateFileW(L"NUL", GENERIC_WRITE, FILE_SHARE_WRITE, &sa, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (null_handle == INVALID_HANDLE_VALUE) {
    null_handle = nullptr;
  }

  const std::wstring wid = std::to_wstring(reinterpret_cast<UINT_PTR>(state.child));
  const std::wstring volume = std::to_wstring(state.volume);
  const std::wstring mute = state.muted ? L"yes" : L"no";
  const std::wstring wide_url = utf8_to_wide(url);

  std::wstring command_line =
    L"mpv.exe --no-config --force-window=yes --idle=no --keep-open=no --osc=no --osd-level=0 "
    L"--msg-level=all=no --terminal=no --input-default-bindings=no --input-vo-keyboard=no "
    L"--hwdec=no --profile=sw-fast --video-sync=display-resample --audio-display=no --cache=yes "
    L"--demuxer-max-back-bytes=50MiB --demuxer-max-bytes=50MiB --wid=" + wid +
    L" --volume=" + volume +
    L" --mute=" + mute +
    L" \"" + wide_url + L"\"";

  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESTDHANDLES;
  startup.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
  startup.hStdOutput = null_handle;
  startup.hStdError = null_handle;

  PROCESS_INFORMATION process_info{};
  std::vector<wchar_t> buffer(command_line.begin(), command_line.end());
  buffer.push_back(L'\0');

  const BOOL created = CreateProcessW(
    nullptr,
    buffer.data(),
    nullptr,
    nullptr,
    TRUE,
    CREATE_NO_WINDOW,
    nullptr,
    nullptr,
    &startup,
    &process_info);

  if (null_handle) CloseHandle(null_handle);

  if (!created) {
    std::cerr << "ERRO: nao foi possivel iniciar o mpv no Windows" << std::endl;
    return;
  }

  state.mpv_process = process_info;
  state.mpv_running = true;
}

void cleanup(AppState& state) {
  stop_media(state);

  if (state.child) {
    DestroyWindow(state.child);
    state.child = nullptr;
  }
}

void reap_child_if_needed(AppState& state) {
  if (!state.mpv_running) return;

  const DWORD result = WaitForSingleObject(state.mpv_process.hProcess, 0);
  if (result == WAIT_OBJECT_0) {
    CloseHandle(state.mpv_process.hThread);
    CloseHandle(state.mpv_process.hProcess);
    state.mpv_process = {};
    state.mpv_running = false;
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

  const std::uint64_t parent_id = std::strtoull(argv[1], nullptr, 16);
  AppState state;

  if (!init_win32(state, parent_id)) return 1;

  std::thread input_thread([&state]() {
    std::string line;
    while (g_running && std::getline(std::cin, line)) {
      handle_command(state, line);
    }
    g_running = false;
  });

  MSG msg{};
  while (g_running) {
    while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
      TranslateMessage(&msg);
      DispatchMessageW(&msg);
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
