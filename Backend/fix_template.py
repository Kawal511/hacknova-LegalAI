# Read the file
with open(r'C:\LegalAi\landing1\src\NyayaZephyrLanding.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the template literals that lost their backticks
# In TetrisBackground useMemo block
content = content.replace("top: \%,", "top: \%,")
content = content.replace("left: \%,", "left: \%,")
content = content.replace("delay: \s,", "delay: \s,")
content = content.replace("duration: \s,", "duration: \s,")

# Write back
with open(r'C:\LegalAi\landing1\src\NyayaZephyrLanding.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed template literals!')
