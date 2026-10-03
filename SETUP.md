# Math Realm: Phase 1, part 1 setup

This part connects three things:

- **A Google Sheet on the district Drive.** It holds every piece of student data: roster, answers, points, mastery and golden tickets.
- **An Apps Script attached to that Sheet.** This is the server. Games send answers to it, and it writes to the Sheet.
- **A GitHub repo with GitHub Pages turned on.** This is the website students open. It never stores student data.

Plan on about 20 minutes. Do it while logged into your **district** Google account, so the Sheet and script are owned by the district domain.

---

## 1. Create the Sheet and add the script

1. In your district Google Drive, create a new Google Sheet named **Math Realm Data**. Keep it private. Students should never get this link.
2. In the Sheet, choose **Extensions ▸ Apps Script**. Rename the project (top left) to **Math Realm Backend**.
3. Delete the starter code in `Code.gs`, paste in everything from `apps-script/Code.gs`, and click **Save**.
4. Go back to the Sheet and reload the page. A **Math Realm** menu appears next to Help (it can take a few seconds).
5. Choose **Math Realm ▸ Set up tabs**. Google will ask for permission:
   - Click **Continue**, pick your district account, then **Allow**.
   - The script asks only for access to this one spreadsheet, not your whole Drive.
   - If you see "Google hasn't verified this app," click **Advanced ▸ Go to Math Realm Backend**. That warning appears for any script you write yourself.
6. You should now have nine tabs: Roster, Skills, Settings, Mastery, Sessions, Attempts, PointsLog, SaveData and Tickets. The Roster tab has one test student.

Running **Set up tabs** again later is safe. It adds anything missing and never deletes data.

## 2. Deploy the server

1. In the Apps Script editor, click **Deploy ▸ New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
4. Click **Deploy**, then copy the **Web app URL**. It ends in `/exec`.
5. Paste that URL into a new browser tab. You should see a short line of text that starts with `{"ok":true,"app":"Math Realm"`.

**If "Anyone" isn't in the access list,** your district has blocked it for staff accounts. Ask district IT whether they can allow it for this one script, and explain that the script only touches one private Sheet. If they can't, tell me, and I'll switch the site so Apps Script serves the pages itself.

**When you change the code later,** don't make a new deployment, because that changes the URL. Instead use **Deploy ▸ Manage deployments**, click the pencil icon, set **Version** to **New version**, and click **Deploy**. The URL stays the same.

## 3. Put the site on GitHub

1. Create a new repository, for example `math-realm`. Public is fine, since no student data lives in it. Free GitHub Pages requires a public repo.
2. Upload these files, keeping the folders:
   ```
   test.html
   js/config.js
   js/api.js
   apps-script/Code.gs      (a backup copy; GitHub doesn't run it)
   SETUP.md
   ```
3. Open `js/config.js` on GitHub, click the pencil icon, replace `PASTE_YOUR_WEB_APP_URL_HERE` with your `/exec` URL, and commit.
4. Go to **Settings ▸ Pages**. Under "Build and deployment," choose **Deploy from a branch**, then **main** and **/ (root)**, and save.
5. After a minute or two, the site is live at `https://YOUR-USERNAME.github.io/math-realm/test.html`.

## 4. Run the test page

Open `test.html` on your GitHub Pages site and go through the four steps in order:

1. **Check connection.** The status pill should turn green.
2. **Log in** with DEMO / TEST1 / 1234. A table of all 14 skills appears.
3. **Perfect round.** Points go up. In the Sheet, new rows appear in Attempts, Sessions, Mastery and PointsLog.
   - **Resend the last round** should say "Recognized as a repeat."
   - **Round with hints** earns points but doesn't count toward mastery.
4. **Save, then load.** A row appears on the SaveData tab.

**Golden ticket test:**

1. On the Skills tab, set `daysNeeded` for `g4.u6.area2` to 1.
2. Choose **Math Realm ▸ Apply Settings and Skills changes now**.
3. Send a perfect round on that skill. A ticket stub appears on the test page, and a row appears on the Tickets tab.
4. Set `daysNeeded` back to 3 when you're done.

If something fails, the reply panel says what went wrong. Server-side details are in the Apps Script editor under **Executions** (the list icon on the left).

## 5. Add your students

On the **Roster** tab, add one row per student:

| Column | What goes in it |
|---|---|
| studentId | The district student ID. The column is plain text, so leading zeros stay. |
| studentName | Full name. Only you see this. It shows up on golden tickets so the person handing out candy knows who it's for. |
| displayName | Optional. What the game calls the student. If blank, the game uses their first name. |
| classCode | A short code for the class, such as `RM12`. Students type it when they log in. Pick something other than DEMO. |
| pin | A 4-digit PIN. Leave it blank, then choose **Math Realm ▸ Fill in missing PINs**. |
| disabled | Check this box to turn off a student's login without deleting their data. |
| points, lifetimePoints, lastLogin | Filled in by the server. |

PINs stop classmates from logging in as each other and spending each other's points. Print each student's class code, ID and PIN on an index card. Once real students are set up, either delete the TEST1 row or change its class code to one only you know.

When pasting a roster from another spreadsheet, use **Paste special ▸ Values only**, so the plain-text formatting that protects leading zeros stays in place.

## How mastery and points work

All of these can be changed on the **Skills** and **Settings** tabs without touching code. Changes take effect within 2 minutes, or right away with **Math Realm ▸ Apply Settings and Skills changes now**.

**When a round counts toward mastery.** A round counts when all of these are true:

- It has at least `minItems` answers.
- At least `minAccuracy` of them are right *without a hint*.
- For fact skills, the student's typical answer time is under `maxMedianMs`. For example, 4000 means 4 seconds. Leave it blank to skip the speed check.

**When a skill is mastered.** A skill is mastered after rounds that count on `daysNeeded` different days. Once mastered, a skill stays mastered.

**Golden tickets.** Skills with `milestone` checked give a golden ticket when mastered. When a student shows you their code, find it on the Tickets tab, check **redeemed**, and type your name in **redeemedBy**.

**Points.**

| Situation | Points |
|---|---|
| Correct answer | 10 |
| Correct answer after a hint | 5 |
| 5 correct in a row, no hints | +5 bonus |
| Mastering a skill | +50 bonus |
| Rounds on a skill already mastered | One quarter of the usual points, so replaying easy skills isn't the fastest way to earn |

## Troubleshooting

| What you see | What to do |
|---|---|
| "The server sent back a web page instead of data" | The deployment's access isn't set to **Anyone**, or the URL in `config.js` ends in `/dev` instead of `/exec`. |
| "Couldn't reach the server" every time | Same as above. A blocked deployment looks like a network failure from the browser's side. |
| Code changes don't seem to take effect | Publish a new version under **Manage deployments** (step 2). |
| "This game uses a skill that isn't on the Skills tab" | The skillId in the game doesn't match the Skills tab exactly. |
| "The server is busy" | Many students finished rounds at the same moment. The game can simply retry. |
