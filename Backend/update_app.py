import re

# Read the file
with open(r'C:\LegalAi\landing1\src\App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add the import for NyayaZephyrLanding after LegalResearcherPage import
old_import = 'import LegalResearcherPage from "./LegalResearcherPage";'
new_import = '''import LegalResearcherPage from "./LegalResearcherPage";
import NyayaZephyrLanding from "./NyayaZephyrLanding";'''

content = content.replace(old_import, new_import)

# Replace the landing page return statement
old_return = 'return <LandingPage onMeetCustomers={() => setCurrentPage("customers")} onDashboard={() => setCurrentPage("dashboard")} />;'
new_return = 'return <NyayaZephyrLanding onStartResearch={() => setCurrentPage("dashboard")} />;'

content = content.replace(old_return, new_return)

# Write back
with open(r'C:\LegalAi\landing1\src\App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('App.tsx updated successfully!')
