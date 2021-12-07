# IPFS video streamer

Stream videos stored in a distributed network using the IPFS protocol

## Install

### Env setup

    cp .env.example .env

    Change the variables accordingly:

    FROM_EMAIL= The email to create account/forgot password
    JWT_SECRET=secret key to jwt generation
    DB_CONNECTION_STRING=dialect://user:pass@host:3306/db_name
    APPNAME= the name of the app
    ORIGIN_NAME=http://example.com:3000
    SENDGRID_API_KEY=API_KEY
    PINATA_API_KEY=API_KEY
    PINATA_SECRET_API_KEY=API_KEY

### Create mysql user

    mysql -u root -p
    create user username@localhost identified by 'password';
    create database ipfsdatabase_example;
    grant all on ipfsdatabase_example.* to username@localhost with grant option;
    edit DB_CONNECTION_STRING according

### Create integration APIs

#### Pinata cloud (for IPFS pinning)

    Go to www.pinata.cloud
    create an account
    create an API key
    add it too PINATA_API_KEY & PINATA_SECRET_API_KEY in .env


#### Sendgrid (for mail sending)

    Go to sendgrid.com
    create an account
    create an API key
    add it too SENDGRID_API_KEY in .env

## Launch

    node index.js
    Run seed.sql into the database in the first time after mysql tables are created



    