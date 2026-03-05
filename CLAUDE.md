# Rules

- NEVER install software, packages, or dependencies on this machine (no brew, npm install, pip install, etc.)
- NEVER modify system configuration (git config, shell profiles, SSH keys, etc.)
- Ask before running any command that modifies anything outside the project directory
- NEVER commit or push to git — the user handles all git operations themselves

# Chat Mode

When the user says "chat mode" or "/chat", enter readonly discussion mode:
- You may READ files but NEVER edit, write, or create files
- No Bash commands that modify anything
- Focus on discussion, brainstorming, and answering questions about the codebase and design
- Stays active until the user says "edit mode" or "/edit" to return to normal
