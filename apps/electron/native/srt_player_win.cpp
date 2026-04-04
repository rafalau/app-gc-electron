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

constexpr bool kUseEmbeddedVideo = true;

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

struct ResizeMpvChildContext {
  int width = 0;
  int height = 0;
};

std::string narrow_from_wide(const std::wstring& value) {
  if (value.empty()) return {};

  const int size = WideCharToMultiByte(CP_UTF8, 0, value.c_str(), -1, nullptr, 0, nullptr, nullptr);
  if (size <= 0) return {};

  std::string narrow(static_cast<size_t>(size - 1), '\0');
  WideCharToMultiByte(CP_UTF8, 0, value.c_str(), -1, narrow.data(), size, nullptr, nullptr);
  return narrow;
}

std::wstring utf8_to_wide(const std::string& value) {
  if (value.empty()) return {};

  const int size = MultiByteToWideChar(CP_UTF8, 0, value.c_str(), -1, nullptr, 0);
  if (size <= 0) return {};

  std::wstring wide(static_cast<size_t>(size - 1), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.c_str(), -1, wide.data(), size);
  return wide;
}

std::string get_last_error_message(DWORD error_code) {
  if (error_code == 0) return {};

  LPSTR buffer = nullptr;
  const DWORD flags = FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS;
  const DWORD size = FormatMessageA(
    flags,
    nullptr,
    error_code,
    MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT),
    reinterpret_cast<LPSTR>(&buffer),
    0,
    nullptr);

  std::string message;
  if (size != 0 && buffer != nullptr) {
    message.assign(buffer, size);
    while (!message.empty() && (message.back() == '\r' || message.back() == '\n')) {
      message.pop_back();
    }
  }

  if (buffer != nullptr) {
    LocalFree(buffer);
  }

  return message;
}

BOOL CALLBACK resize_mpv_child_callback(HWND hwnd, LPARAM lparam) {
  auto* context = reinterpret_cast<ResizeMpvChildContext*>(lparam);
  if (!context) return TRUE;

  SetWindowPos(
    hwnd,
    nullptr,
    0,
    0,
    context->width,
    context->height,
    SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER);

  return TRUE;
}

BOOL CALLBACK log_mpv_child_callback(HWND hwnd, LPARAM) {
  wchar_t class_name[256]{};
  GetClassNameW(hwnd, class_name, 255);

  RECT rect{};
  GetWindowRect(hwnd, &rect);

  std::cerr
    << "INFO: filho hwnd=" << reinterpret_cast<UINT_PTR>(hwnd)
    << " class=" << narrow_from_wide(class_name)
    << " rect=(" << rect.left << ", " << rect.top << ", "
    << (rect.right - rect.left) << ", " << (rect.bottom - rect.top) << ")"
    << std::endl;
  return TRUE;
}

void sync_mpv_child_window(const AppState& state) {
  if (!state.child) return;

  RECT rect{};
  if (!GetClientRect(state.child, &rect)) return;

  ResizeMpvChildContext context{};
  context.width = rect.right - rect.left;
  context.height = rect.bottom - rect.top;
  if (context.width < 1 || context.height < 1) return;

  EnumChildWindows(state.child, resize_mpv_child_callback, reinterpret_cast<LPARAM>(&context));
}

void log_mpv_host_windows(const AppState& state) {
  if (!state.child) return;

  RECT rect{};
  if (GetClientRect(state.child, &rect)) {
    std::cerr
      << "INFO: host hwnd=" << reinterpret_cast<UINT_PTR>(state.child)
      << " client=(" << rect.left << ", " << rect.top << ", "
      << (rect.right - rect.left) << ", " << (rect.bottom - rect.top) << ")"
      << std::endl;
  }

  EnumChildWindows(state.child, log_mpv_child_callback, 0);
}

void sync_window(const AppState& state) {
  if (!state.child) return;

  SetWindowPos(
    state.child,
    HWND_TOP,
    state.x,
    state.y,
    state.width,
    state.height,
    SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOOWNERZORDER);

  ShowWindow(state.child, state.visible ? SW_SHOWNA : SW_HIDE);
  sync_mpv_child_window(state);
}

bool init_win32(AppState& state, std::uint64_t parent_id) {
  const auto parent_handle = static_cast<std::uint32_t>(parent_id & 0xffffffffu);
  state.parent = reinterpret_cast<HWND>(static_cast<UINT_PTR>(parent_handle));
  if (!IsWindow(state.parent)) {
    std::cerr << "ERRO: janela pai invalida" << std::endl;
    return false;
  }

  const LONG_PTR parent_style = GetWindowLongPtrW(state.parent, GWL_STYLE);
  SetWindowLongPtrW(state.parent, GWL_STYLE, parent_style | WS_CLIPCHILDREN | WS_CLIPSIBLINGS);
  SetWindowPos(
    state.parent,
    nullptr,
    0,
    0,
    0,
    0,
    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);

  state.child = CreateWindowExW(
    WS_EX_NOACTIVATE,
    L"STATIC",
    L"",
    WS_CHILD | WS_CLIPCHILDREN | WS_CLIPSIBLINGS,
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
  ShowWindow(state.child, SW_HIDE);

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

  std::cerr << "INFO: iniciando SRT com URL: " << url << std::endl;

  state.visible = true;
  sync_window(state);

  const auto child_handle = static_cast<std::uint32_t>(reinterpret_cast<UINT_PTR>(state.child) & 0xffffffffu);
  const std::wstring wid = std::to_wstring(child_handle);
  const std::wstring volume = std::to_wstring(state.volume);
  const std::wstring mute = state.muted ? L"yes" : L"no";
  const std::wstring wide_url = utf8_to_wide(url);
  wchar_t mpv_path_buffer[MAX_PATH];
  const DWORD mpv_path_size = SearchPathW(nullptr, L"mpv.exe", nullptr, MAX_PATH, mpv_path_buffer, nullptr);

  if (mpv_path_size == 0 || mpv_path_size >= MAX_PATH) {
    const DWORD error_code = GetLastError();
    std::cerr << "ERRO: mpv.exe nao encontrado no PATH";
    if (error_code != 0) {
      std::cerr << " (codigo " << error_code << ": " << get_last_error_message(error_code) << ")";
    }
    std::cerr << std::endl;
    return;
  }

  const std::wstring mpv_path(mpv_path_buffer);
  const size_t last_sep = mpv_path.find_last_of(L"\\/");
  const std::wstring mpv_dir = last_sep == std::wstring::npos ? L"" : mpv_path.substr(0, last_sep);
  std::wstring command_line = L"\"" + mpv_path + L"\" --no-config ";

  command_line +=
    L"--vo=gpu --gpu-context=d3d11 --force-window=yes --idle=no --keep-open=no --osc=no --osd-level=0 "
    L"--msg-level=all=no --terminal=no --input-default-bindings=no --input-vo-keyboard=no "
    L"--hwdec=no --profile=sw-fast --profile=low-latency --video-sync=audio --keepaspect=no "
    L"--audio-display=no --cache=no --cache-pause=no --demuxer-readahead-secs=0.1 "
    L"--demuxer-max-back-bytes=1MiB --demuxer-max-bytes=4MiB --wid=" + wid;

  command_line +=
    L" --volume=" + volume +
    L" --mute=" + mute +
    L" \"" + wide_url + L"\"";

  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESTDHANDLES;
  startup.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
  startup.hStdOutput = GetStdHandle(STD_ERROR_HANDLE);
  startup.hStdError = GetStdHandle(STD_ERROR_HANDLE);

  PROCESS_INFORMATION process_info{};
  std::vector<wchar_t> buffer(command_line.begin(), command_line.end());
  buffer.push_back(L'\0');

  const BOOL created = CreateProcessW(
    mpv_path.c_str(),
    buffer.data(),
    nullptr,
    nullptr,
    TRUE,
    CREATE_NO_WINDOW,
    nullptr,
    mpv_dir.empty() ? nullptr : mpv_dir.c_str(),
    &startup,
    &process_info);

  if (!created) {
    const DWORD error_code = GetLastError();
    std::cerr << "ERRO: nao foi possivel iniciar o mpv no Windows";
    if (error_code != 0) {
      std::cerr << " (codigo " << error_code << ": " << get_last_error_message(error_code) << ")";
    }
    std::cerr << std::endl;
    return;
  }

  state.mpv_process = process_info;
  state.mpv_running = true;
  std::cerr << "INFO: mpv iniciado para a janela filha " << reinterpret_cast<UINT_PTR>(state.child) << std::endl;
  Sleep(250);
  sync_mpv_child_window(state);
  log_mpv_host_windows(state);
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
    DWORD exit_code = 0;
    if (GetExitCodeProcess(state.mpv_process.hProcess, &exit_code)) {
      std::cerr << "INFO: mpv finalizado com codigo " << exit_code << std::endl;
    } else {
      std::cerr << "INFO: mpv finalizado" << std::endl;
    }
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
    } else {
      std::cerr << "ERRO: comando PLAY recebido sem URL" << std::endl;
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
    if (state.mpv_running) {
      log_mpv_host_windows(state);
    }
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

    sync_window(state);
    reap_child_if_needed(state);
    std::this_thread::sleep_for(std::chrono::milliseconds(16));
  }

  cleanup(state);

  if (input_thread.joinable()) {
    input_thread.join();
  }

  return 0;
}
