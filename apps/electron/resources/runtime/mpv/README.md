Estrutura esperada para empacotar o runtime do mpv por plataforma:

- `resources/runtime/mpv/linux/`
- `resources/runtime/mpv/win32/`

No Windows, coloque aqui o `mpv.exe` e as DLLs necessárias para o player embutido.
O processo principal adiciona automaticamente essa pasta ao `PATH`/`Path` do helper nativo.
