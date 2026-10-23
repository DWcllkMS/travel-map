import os
import sys
import zipfile
import fnmatch
from datetime import datetime

def load_excluded_patterns(root_dir):
    patterns = [
        '.git',
        '.git/*',
        'node_modules',
        'node_modules/*',
        'dist',
        'dist/*',
        'dev-dist',
        'dev-dist/*',
        'data-cache',
        'data-cache/*',
        '__pycache__',
        '__pycache__/*',
        '*.pyc',
        '.DS_Store',
        'Thumbs.db',
        '*.log'
    ]

    gitignore_path = os.path.join(root_dir, '.gitignore')
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        inside_artifacts_section = False
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
            if 'claude-artifacts: begin' in line_str:
                inside_artifacts_section = True
                continue
            if 'claude-artifacts: end' in line_str:
                inside_artifacts_section = False
                continue
            if inside_artifacts_section and not line_str.startswith('#'):
                clean_pattern = line_str.rstrip('/')
                patterns.append(clean_pattern)
                patterns.append(clean_pattern + '/*')

    return patterns

def is_excluded(rel_path, patterns):
    normalized = rel_path.replace('\\', '/')
    parts = normalized.split('/')

    for pattern in patterns:
        clean_pat = pattern.replace('\\', '/')
        if fnmatch.fnmatch(normalized, clean_pat):
            return True
        for part in parts:
            if fnmatch.fnmatch(part, clean_pat):
                return True
    return False

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    parent_dir = os.path.dirname(root_dir)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    zip_filename = f'map_package_{timestamp}.zip'
    zip_path = os.path.join(parent_dir, zip_filename)

    patterns = load_excluded_patterns(root_dir)

    print(f'Создание архива: {zip_path}')
    total_files = 0

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            rel_dir = os.path.relpath(root, root_dir)
            if rel_dir != '.' and is_excluded(rel_dir, patterns):
                dirs[:] = []
                continue

            dirs[:] = [d for d in dirs if not is_excluded(os.path.join(rel_dir, d) if rel_dir != '.' else d, patterns)]

            for file in files:
                rel_file = os.path.join(rel_dir, file) if rel_dir != '.' else file
                if is_excluded(rel_file, patterns):
                    continue

                full_path = os.path.join(root, file)
                zipf.write(full_path, rel_file)
                total_files += 1

    size_mb = os.path.getsize(zip_path) / (1024 * 1024)
    print(f'Архив успешно создан: {zip_path}')
    print(f'Файлов упаковано: {total_files}, размер: {size_mb:.2f} МБ')

if __name__ == '__main__':
    main()
