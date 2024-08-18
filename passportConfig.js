const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
dotenv.config();

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();

passport.use(new LocalStrategy(
  async function(username, password, done) {
    console.log(`Authentication attempt by: [${username}]`);
    
    const params = {
      TableName: 'crypto-users',
      Key: {
        'email': username
      }
    };
    
    try {
      const data = await docClient.get(params).promise();
      console.log('Data read from DynamoDB:', JSON.stringify(data, null, 2));
      
      const user = data.Item; // Data is stored in the `Item` field
      
      if (!user) {
        console.log('User does not exist.');
        return done(null, false, { message: 'User does not exist.' });
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        console.log('Incorrect password for user:', username);
        return done(null, false, { message: 'Incorrect password.' });
      }

      console.log('Authentication successful for user:', username);
      return done(null, user);

    } catch (err) {
      console.error('Error reading from DynamoDB:', JSON.stringify(err, null, 2));
      return done(err);
    }
  }
));

// Serialize and deserialize user to maintain session
passport.serializeUser(function(user, done) {
  console.log('Serializing user:', user.email);
  done(null, user.email);
});

passport.deserializeUser(async function(email, done) {
  const params = {
    TableName: 'crypto-users',
    Key: {
      'email': email
    }
  };

  try {
    const data = await docClient.get(params).promise();
    const user = data.Item;
    
    if (user) {
      console.log('Deserializing user:', user.email);
    } else {
      console.log('User not found during deserialization');
    }
    
    done(null, user);

  } catch (err) {
    console.error('Error deserializing user:', JSON.stringify(err, null, 2));
    done(err);
  }
});
