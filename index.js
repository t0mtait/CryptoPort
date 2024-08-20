const bodyParser = require('body-parser');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash'); // Import connect-flash
const port = 3000;
require('dotenv').config();
const request = require('request');
const passport = require('passport');
require('./passportConfig.js'); // Ensure this file is correctly configured
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
dotenv.config();
const saltRounds = 10;


AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();

const app = express();

// Middleware configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// Routes
app.post('/login', (req,res,next) => {
    passport.authenticate('local', (err,user) => {
        if (err)
        {
            console.error('Login error:', err);
            return next(err);
        }
        if (!user) 
        {
            console.warn('failed login for user')
        }
        req.logIn(user, (err) => {
            if (err) {
                console.error('Error logging in user');
                return next(err);
            }
            console.log('User logged in successfully');
            return res.redirect('/');
        });
    })(req,res,next)
    })

app.post('/register', async (req,res) => {
        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
        const params = {
          TableName: 'crypto-users',
          Item: {
            email: req.body.email,
            password: hashedPassword,
            username: req.body.email,
            picture: 'https://static.vecteezy.com/system/resources/previews/021/548/095/original/default-profile-picture-avatar-user-avatar-icon-person-icon-head-icon-profile-picture-icons-default-anonymous-user-male-and-female-businessman-photo-placeholder-social-network-avatar-portrait-free-vector.jpg'
          }
        };
        docClient.put(params).promise();
        console.log('user registered.')
        res.redirect('/login');
})

app.post('/submitProfileChanges', async (req, res) => {
    const image = req.body.picture;
    const base64Image = Buffer.from(image).toString('base64');

    const params = {
        TableName: 'crypto-users',
        Key: {
            email: req.user.email  // Use the user's email to identify the item
        },
        UpdateExpression: 'set picture = :picture, username = :username',
        ExpressionAttributeValues: {
            ':picture': base64Image ,
            ':username': req.body.username
        },
        ReturnValues: 'UPDATED_NEW'  // Return updated attributes
    };

    try {
        const data = await docClient.update(params).promise();
        console.log('Update succeeded:', JSON.stringify(data, null, 2));
        res.status(200).json({ message: 'Profile updated successfully', data });
    } catch (err) {
        console.error('Unable to update item. Error JSON:', JSON.stringify(err, null, 2));
        res.status(500).json({ error: 'Unable to update profile' });
    }
});



app.get('/login', (req, res) => {
    res.render('login');
});
app.get('/register', (req, res) => {
    res.render('register');
})

app.get('/', (req, res) => {
    if (req.isUnauthenticated()) {
        return res.redirect('/login');
    }

    const options = {
        method: 'GET',
        url: 'http://api.coincap.io/v2/assets?limit=2000',
        headers: {}
    };

    request(options, function (error, response) {
        if (error) {
            console.error('API request error:', error);
            return res.status(500).send('Internal Server Error');
        }

        let data = response.body;

        try {
            data = JSON.parse(data);  // Parse the API response body
            const assets = data.data; // Access the 'data' property in the response

            // Render the page with assets and user picture
            res.render('index', { data: assets, user: req.user });
        } catch (parseError) {
            console.error('Error parsing API response:', parseError);
            res.status(500).send('Error processing API data');
        }
    });
});



app.get('/profile', (req, res) => {
    res.render('profile', { user: req.user });
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
