# Read the file
with open(r'C:\LegalAi\landing1\src\App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove duplicate import
content = content.replace('import NyayaZephyrLanding from "./NyayaZephyrLanding";\nimport NyayaZephyrLanding from "./NyayaZephyrLanding";', 'import NyayaZephyrLanding from "./NyayaZephyrLanding";')

# Write back
with open(r'C:\LegalAi\landing1\src\App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed duplicate import!')
