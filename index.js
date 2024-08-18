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
            password: hashedPassword
          }
        };
        docClient.put(params).promise();
        console.log('user registered.')
        res.redirect('/login');
})

app.get('/login', (req, res) => {
    res.render('login');
});
app.get('/register', (req, res) => {
    res.render('register');
})
app.get('/', (req, res) => {
    if (req.isUnauthenticated()) {
        res.redirect('/login');
    }
    var options = {
        'method': 'GET',
        'url': 'http://api.coincap.io/v2/assets?limit=2000',
        'headers': {}
    };
    request(options, function (error, response) {
        if (error) {
            console.error('API request error:', error);
            return res.status(500).send('Internal Server Error');
        }
        let data = response.body;
        try {
            data = JSON.parse(data);
            data = data.data;
            res.render('index', { data: data, user: req.user });
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
