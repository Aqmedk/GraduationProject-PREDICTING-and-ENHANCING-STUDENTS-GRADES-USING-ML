import express from 'express';
import browserSync, { get } from 'browser-sync';
import methodOverride from 'method-override';
import bodyParser from 'body-parser';
import session from 'express-session';
import axios from 'axios';
import pg from 'pg';
import path from 'path';
import OpenAI from 'openai';
import { json } from 'stream/consumers';

const print = console.log.bind();
const app = express();
const Port = 3000;
const bs = browserSync.create();

// Serve static files
app.use(express.static(path.join(process.cwd(), 'public')));
app.set('view engine', 'ejs');
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use('/node_modules', express.static('node_modules'));
app.use(session({
    secret: 'Predict',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 60 * 60 * 1000 // node session 1-hour
    }
}));
const openai = new OpenAI({ apiKey: });
// const db = new pg.Pool({
//     user: "postgres",
//     host: "localhost",
//     database: "postgres",
//     password: "Saleh2002",
//     port: 5432,
// });

const db = new pg.Pool({
    user: "grad_project_user",
    host: "dpg-d0bpr5ruibrs73dijrtg-a.oregon-postgres.render.com",
    database: "grad_project",
    password: "x1Aaa66bz2dT0g2XpvjVdkNI6fxtCgfY",
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect()
    .then(() => print("Database connected successfully"))
    .catch(err => {
        console.error("Database connection error:", err.response?.data || err.message);
        process.exit(1); // Exit if DB connection fails
    });



app.get('/', (req, res) => { res.render('GetStarted'); });

app.get('/AI', isLoggedIn, async (req, res) => {
    const AITraning = `You are a smart academic assistant who only answers questions related to the following university courses:

1. CS 214 – Data Structures  
   - Only provide answers based on the textbook: "Data Structures Using C and C++" by Yedidyah Langsam.

2. CS 383 – Software Engineering  
   - Base your answers primarily on:  
     "Software Engineering" by Ian Somerville, 9th Edition.  
   - You may also reference the following supplementary materials if relevant:  
     • "UML Distilled", 3rd Edition by Martin Fowler  
     • "Design Patterns: Elements of Reusable Object-Oriented Software", 1st Edition by R. Helm, R. Johnson, J. Vlissides, and G. Booch.

3. MATH 116 – Linear Algebra  
   - Only answer using the textbook: "Elementary Linear Algebra" by Howard Anton & Chris Rorres, 10th Edition, 2011.

Your tasks:
- Start the conversation with "Hello ${req.session.user.fullname.split(" ")[0]}, how can I assist you with your studies?"
- If the user's question is related to one of these three courses, provide a clear, concise academic answer.
- If the question is vague or unclear, ask the user to specify which subject (CS 214, CS 383, or MATH 116) they are asking about.
- If the question is clearly unrelated, respond with:
"I'm sorry, I can only assist with questions related to CS 214 (Data Structures), CS 383 (Software Engineering), or MATH 116 (Linear Algebra)."


Language rules:
- If the user writes in Arabic, reply only in Arabic.
- If the user writes in English, reply only in English.
- Do not mix both languages in one response.
- and you can say the name of the user  
`

    const AIarray = req.session.AIarray || [];
    if (AIarray.length === 0) {
        try {
            const response = await getAIResponse(AITraning);
            AIarray.push({ AI: response, Me: "Hello!" });
            req.session.AIarray = AIarray; // Save the updated conversation
        } catch (error) {
            AIarray.push({ AI: "I'm sorry, I couldn't process your request at the moment.", Me: "Hello!" });
            req.session.AIarray = AIarray; // Save the fallback response
        }
    }
    res.render('AI', { AIarray });
});

app.post('/AI', isLoggedIn, express.json(), async (req, res) => {
    try {
        const userMessage = req.body.message;
        const AIresponse = await getAIResponse(userMessage);

        if (!req.session.AIarray) {
            req.session.AIarray = [];
        }

        req.session.AIarray.push({ AI: AIresponse, Me: userMessage });

        // Return only the new message in JSON
        res.json({ AI: AIresponse });
    } catch (error) {
        console.error(error);
        res.status(500).json({ AI: "Sorry, I couldn't process your request right now." });
    }
});


app.get('/Login', (req, res) => {
    const errorMessage = req.session.errmsg || null;

    res.render('Login', { errmsg: errorMessage });
});
app.get('/Register', (req, res) => { res.render('Register'); });

app.post('/Register', (req, res) => {
    let { username, password, email, GPA, LEVEL, CS222, CS182, MATH115 } = req.body;
    email = email.trim().toLowerCase();
    print("Data received:", username, password, email, GPA, LEVEL, CS222, CS182, MATH115);
    // Validate input data 

    // Check if the user is already registered
    const checkQuery = `SELECT * FROM students WHERE email = $1 OR fullname = $2`;
    const checkValues = [email, username];

    db.query(checkQuery, checkValues)
        .then(result => {
            if (result.rows.length > 0) {
                return res.status(400).send('User already registered.');
            }

            // Insert new user with grades
            const query = ` 
                INSERT INTO students (fullname, password, email, gpa, level, cs222, cs182, math115) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
            const values = [username, password, email, GPA, LEVEL, CS222, CS182, MATH115];
            return db.query(query, values);
        })
        .then(() => {
            res.redirect('/Login');
        })
        .catch(err => {
            res.status(500).send(`Error registering user: ${err}`);
        });
});

app.post('/Login', (req, res) => {
    let { email, password } = req.body;
    email = email.trim().toLowerCase();

    const query = `SELECT * FROM students WHERE email = $1 AND password = $2`;
    const values = [email, password];

    db.query(query, values)
        .then(result => {
            if (result.rows.length > 0) {
                req.session.user = result.rows[0];
                res.redirect('/MainMenu');
            } else {
                req.session.errmsg = "Invalid email or password";
                res.redirect('/MainMenu');
            }
        })
        .catch(err => {
            res.status(500).send(`Error logging in: ${err}`);
        });
});

app.get('/predict', isLoggedIn, (req, res) => {
    res.render('Predict', { prediction: null }); // This prevents EJS from crashing
});

app.post('/predict', isLoggedIn, async (req, res) => {
    try {
        const { subject, semHours } = req.body;
        const allowedSubjects = ["CS383", "MATH116", "CS214"];

        if (!allowedSubjects.includes(subject)) {
            return res.status(400).send("Invalid subject selected for prediction.");
        }

        const subjectKey = subject.toLowerCase();

        // Check if the subject grade is already set
        const currentGrade = req.session.user[subjectKey];
        // if (currentGrade) {
        //     return res.status(403).send(`A prediction for ${subject} already exists and cannot be changed.`);
        // }

        // Prepare data for Python prediction service
        const inputData = {
            subject,
            CS222: await LetterToGPA(req.session.user.cs222),
            CS182: await LetterToGPA(req.session.user.cs182),
            MATH115: await LetterToGPA(req.session.user.math115),
            GPA: req.session.user.gpa,
            semester_hours: semHours
        };

        const response = await axios.post("http://127.0.0.1:5001/predict", inputData, { headers: { "Content-Type": "application/json" } });
        const prediction = response.data.prediction;
        const predictionLetter = await GPAtoLetter(prediction)

        // ✅ Now update session and DB after predictionLetter is defined
        req.session.user[subjectKey] = predictionLetter;
        const updateQuery = `UPDATE students SET ${subjectKey} = $1 WHERE email = $2`;
        const updateValues = [predictionLetter, req.session.user.email];
        await db.query(updateQuery, updateValues);

        // Render results (match the EJS expectations)
        res.render('Predict', {
            prediction: {
                subject,
                numerical_grade: prediction,
                letter_grade: predictionLetter
            }
        });

    } catch (error) {
        console.error("Prediction error:", error.response?.data || error.message);
        res.status(500).send("An unexpected error occurred while processing the prediction.");
    }
});

app.post('/EditPage', isLoggedIn, async (req, res) => {
    try {
        const { cs182, cs222, math115 } = req.body;
        cs182 === "CHOOSE" ? null : await db.query(`UPDATE students SET cs182 = $1 WHERE email = $2`, [cs182, req.session.user.email]);
        cs222 === "CHOOSE" ? null : await db.query(`UPDATE students SET cs222 = $1 WHERE email = $2`, [cs222, req.session.user.email]);
        math115 === "CHOOSE" ? null : await db.query(`UPDATE students SET math115 = $1 WHERE email = $2`, [math115, req.session.user.email]);
        req.session.user.cs182 = cs182 === "CHOOSE" ? req.session.user.cs182 : cs182;
        req.session.user.cs222 = cs222 === "CHOOSE" ? req.session.user.cs222 : cs222;
        req.session.user.math115 = math115 === "CHOOSE" ? req.session.user.math115 : math115;
        res.redirect('/MainMenu');
    }
    catch (error) {
        console.error("Error updating subjects:", error.response?.data || error.message);
        res.status(500).send("An unexpected error occurred while updating the subjects.");
    }
});

app.get('/MainMenu', isLoggedIn, (req, res) => {
    const CS222 = req.session.user.cs222;
    const CS182 = req.session.user.cs182;
    const MATH115 = req.session.user.math115;
    const CS383 = req.session.user.cs383 ? req.session.user.cs383 : "N/A";
    const MATH116 = req.session.user.math116 ? req.session.user.math116 : "N/A";
    const CS214 = req.session.user.cs214 ? req.session.user.cs214 : "N/A";

    res.render('MainMenu', {
        CS222: CS222,
        CS182: CS182,
        MATH115: MATH115,
        CS383: CS383,
        MATH116: MATH116,
        CS214: CS214
    });
});
app.get('/ProfilePage', isLoggedIn, (req, res) => {

    const UserName = req.session.user.fullname;
    const Level = req.session.user.level;
    res.render('ProfilePage', { username: UserName.split(" ")[0], level: Level });
});
app.get('/EditPage', isLoggedIn, (req, res) => { res.render('EditPage'); });
//app.get('/AddSubject', isLoggedIn, (req, res) => { res.render('AddSubject'); });
app.get('/Predict', isLoggedIn, (req, res) => { res.render('Predict'); });
app.get('/Enhance', isLoggedIn, (req, res) => { res.render('Enhance'); });
app.get('/QuizPages', isLoggedIn, (req, res) => { res.render('QuizPages'); });
app.get('/About', isLoggedIn, (req, res) => { res.render('About'); });
app.get('/Resources', isLoggedIn, (req, res) => { res.render('Resources'); });
app.get('/Logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send("Unable to log out.");
        }
        res.redirect("/");
    });
});

app.listen(Port, () => { print(`Server is running on port http://localhost:${Port}`); });


async function getAIResponse(prompt) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 100
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error("Error in getAIResponse:", error.response?.data || error.message);
        return `I'm sorry ${req.session.user.fullname.split(" ")[0]}, I couldn't process your request at the moment. Please try again later.`;
    }
}

async function isLoggedIn(req, res, next) {
    res.set('Cache-Control', 'no-store'); // Prevent caching of the page
    if (req.session.user) {
        return next();
    }
    res.redirect("/Login");
}

async function LetterToGPA(letter) {
    const mapping = {
        'A+': 4.5,
        'A': 4.0,
        'B+': 3.5,
        'B': 3.0,
        'C+': 2.5,
        'C': 2.0,
        'D+': 1.5,
        'D': 1.0,
        'F': 0.0
    };
    return mapping[letter] || 0;
}
async function GPAtoLetter(gpa) {
    if (gpa >= 4.5) {
        return 'A+';
    } else if (gpa >= 4.0) {
        return 'A';
    } else if (gpa >= 3.5) {
        return 'B+';
    } else if (gpa >= 3.0) {
        return 'B';
    } else if (gpa >= 2.5) {
        return 'C+';
    } else if (gpa >= 2.0) {
        return 'C';
    } else if (gpa >= 1.5) {
        return 'D+';
    } else if (gpa >= 1.0) {
        return 'D';
    } else {
        return 'F';
    }
}


async function getPythonRequest(route) {
    try {
        const response = await axios.get(`http://127.0.0.1:5001/${route}`, { headers: { "Content-Type": "application/json" } });
        return response;
    } catch (error) {
        console.error("Error during prediction:", error.response?.data || error.message);
        throw new Error("Internal Server Error");
    }
}
// Uncomment to use BrowserSync for live reloading
// bs.init({
//     proxy: `http://localhost:${Port}`,
//     files: ['views/**/*.ejs', 'public/**/*.{css,js}'], // Watch for changes in EJS, CSS, and JS files
//     port: 3001, // Choose a different port for BrowserSync
// });