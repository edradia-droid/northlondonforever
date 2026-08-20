NL4 CURRENT GENERATION → ADMIN PROFILE EDITOR

FILES
- current-generation.html
- saka.html
- ode.html
- rice.html
- saliba.html
- gabby.html
- kai.html
- nelly.html
- current-player-profile.js
- admin.html
- admin.js
- admin.css
- NL4-current-player-profiles-setup.sql

INSTALL
1. Run NL4-current-player-profiles-setup.sql once in Supabase SQL Editor.
2. Copy the HTML/JS/CSS files into the NL4 project, replacing the matching current versions.
3. Keep your existing supabase-client.js unchanged.
4. Open Admin → Current Player Profiles.
5. Choose a player, edit the text, and click Save & Publish Profile.
6. Refresh that player's public page to see the saved Supabase text.

SAFETY
The original HTML text remains in each profile as a fallback. If Supabase cannot load,
the page still shows the existing profile instead of becoming blank.
