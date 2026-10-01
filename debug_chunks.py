import re
with open('f:/Peter/Practice/TimeTrackerApp-V0.2/src/components/Settings.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

parts = content.split('return (\n    <main className="settings-page">')
post = parts[1]
grid_parts = post.split('<div className="settings-bento-grid-layout">')
post_grid = grid_parts[1]
chunks = re.split(r'(?=\s*<div className="settings-bento-card)', post_grid)

for i, c in enumerate(chunks):
    if c.strip():
        match = re.search(r'<h2.*?>(.*?)</h2>', c)
        if match:
            print(f'Chunk {i}: {match.group(1)}')
        else:
            print(f'Chunk {i}: No H2 found, preview: {c[:100]}...')
