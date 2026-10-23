import os
import sys
import subprocess
import socket
import time
import webbrowser

def find_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1.0)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def wait_for_port(port, timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=0.5):
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(0.3)
    return False

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root_dir)

    use_host = '--host' in sys.argv

    npm_cmd = 'npm.cmd' if sys.platform == 'win32' else 'npm'
    node_cmd = 'node.exe' if sys.platform == 'win32' else 'node'

    try:
        subprocess.run([node_cmd, '-v'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except Exception:
        print('Ошибка: Node.js не найден в системе. Установите Node.js 18+.')
        sys.exit(1)

    node_modules_path = os.path.join(root_dir, 'node_modules')
    if not os.path.exists(node_modules_path):
        print('Установка зависимостей...')
        subprocess.run([npm_cmd, 'install'], check=True)

    cmd = [npm_cmd, 'run', 'dev']
    if use_host:
        cmd.extend(['--', '--host', '0.0.0.0'])

    print('Запуск сервера разработки...')
    proc = subprocess.Popen(cmd)

    port = 5173
    if wait_for_port(port):
        local_url = f'http://localhost:{port}'
        lan_ip = find_lan_ip()
        lan_url = f'http://{lan_ip}:{port}'

        print('\n' + '=' * 50)
        print('Приложение успешно запущено:')
        print(f'  Локальный адрес:  {local_url}')
        if use_host:
            print(f'  С мобильного Wi-Fi: {lan_url}')
        print('=' * 50 + '\n')

        try:
            webbrowser.open(local_url)
        except Exception:
            pass
    else:
        print('Сервер запускается, откройте браузер вручную.')

    try:
        proc.wait()
    except KeyboardInterrupt:
        print('\nОстановка сервера...')
        proc.terminate()
        proc.wait()

if __name__ == '__main__':
    main()
