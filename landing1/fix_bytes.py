# Fix corrupted Unicode bytes in App.tsx
import re

with open('src/App.tsx', 'rb') as f:
    data = f.read()

# Define byte replacements - corrupted sequences to ASCII
replacements = [
    # Refresh icon (line 1078): C3 B0 C5 B8 E2 80 9D E2 80 9E
    (bytes([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x9D, 0xE2, 0x80, 0x9E]), b''),
]

for old, new in replacements:
    count = data.count(old)
    if count > 0:
        print(f"Replacing {count} occurrence(s) of {old.hex()}")
        data = data.replace(old, new)

with open('src/App.tsx', 'wb') as f:
    f.write(data)

print("Done!")
