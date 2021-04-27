const IPFS = require('ipfs');
const express = require('express');
const fileUpload = require('express-fileupload')
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const fs = require('fs');
const Path = require('path');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const nodeMailer = require('nodemailer');
require('dotenv').config()

const db = require('./persistence/db')
const {User,File} = require('./persistence/models')
const AuthMiddleware = require('./middleware/auth')
const validateVideoInput = require('./middleware/validateVideoInput')
const validateSingUp = require('./middleware/validateSingup')
const validateLogin = require('./middleware/validateLogin')
const getLoggedUser = require('./middleware/getLoggedUser')
const handleCsrfError = require('./middleware/handleCsrfError');
const validateNewSingupToken = require('./middleware/validateNewSingupToken')
const validateForgotPassword = require('./middleware/validateForgotPassword') 
const validateResetPassword  = require('./middleware/validateResetPassword') 
const validateChangePassword  = require('./middleware/validateChangePassword') 
const validateUpdateImage = require('./middleware/validateUpdateImage')

async function main () {
    const repoPath = '.ipfs-node-main'
    const ipfs = await IPFS.create({silent: true, repo: repoPath })
    const app = express()

    const transporter = nodeMailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.FROM_EMAIL,
          pass: process.env.FROM_EMAIL_PASSWORD
        }
    });

    const csrfMiddleware = csurf({
        cookie: true
    });
    
    app.set('view engine', 'ejs')
    app.use(express.json())
    app.use(express.urlencoded({ extended: true}))
    
    app.use(cookieParser());

    app.use(fileUpload())
    
    app.use(express.static(__dirname + '/public'));
    app.use(csrfMiddleware);
    app.use(handleCsrfError)

    const goHome = async (req, res, args) => {
        const vids = await File.getVideosHomePage();
        return res.render('main', {page: 'home', params: {...args, csrfToken: req.csrfToken(), vids }})

    } 

    app.get('/', getLoggedUser, async (req, res) => {
        return goHome(req, res, {user: req.user})
    })

    app.get('/singup', getLoggedUser, (req, res) => {
        if(req.user){
            return goHome(req, res, {user: req.user})
        }
        res.render('main', {page: 'singup', params: {csrfToken: req.csrfToken()}})
    })

    app.get('/profile', AuthMiddleware, (req, res) => {
        if(!req.user){
            return goHome(req, res, {})
        }

        res.render('main', {page: 'profile', params: { csrfToken: req.csrfToken(), user: req.user }})
    })
    
    app.post('/changePassword', AuthMiddleware, validateChangePassword, async (req, res) => {
        const changed = await req.user.changePassword(req.body.password, req.body.newPassword)
        if(changed) 
            res.render('main', {page: 'profile', params: { csrfToken: req.csrfToken(), user: req.user }})
        else return goHome(req, res, {status: 'Error changing user password'})
    })

    app.get('/login', getLoggedUser, (req, res) => {
        if(req.user){
            return goHome(req, res, {user: req.user})
        }
        res.render('main', {page: 'login', params: {csrfToken: req.csrfToken()}})
    })

    app.post('/login', validateLogin, async (req, res) => {

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid request' }});
        }

        try {
            let user = await User.authenticate(username, password)
            if(user){
                console.log('returned user: ' + JSON.stringify(user))
                if(!user.confirmed)
                    return goHome(req, res, {status: 'User email not confirmed'})

                res.cookie('authToken', user.authToken, { maxAge: 8320000, httpOnly: true });

                return goHome(req, res, {user})
            } else console.log('Usuário não autenticado')

        } catch (err) {
            console.log(err)
            return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid credentials' }});
        }

    })

    app.post('/logout', AuthMiddleware, async (req, res) => {

        const { user, cookies: { authToken: authToken } } = req
      
        if (user && authToken) {
            await User.logout(authToken);
            return goHome(req, res, {})
        }

        return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid request' }});
      });

    app.post('/singup', validateSingUp, async (req, res) => {

        try {
            let user = await User.createNew(req.body.email, req.body.username, req.body.password)
            if(user){
                sendConfirmEmail(user)
                return goHome(req, res, {})

            }
            else {
                throw new Error('Error registering the new user, please contact the administration')
            }
            
        } catch(err) {
            console.log(err)
            return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid credentials' }});
        }

    })
    
    app.get('/watch', getLoggedUser, (req, res) => {
        res.render('main', {page: 'watch', params: { fileHash: req.query.filehash, fileName: req.query.filename }})
    })

    app.get('/validateSingupToken', async (req, res) => {
        if(req.query.token){
            if(await User.validateSingup(req.query.token))
                return goHome(req, res, {status: 'Token validated!'})
            else
                return goHome(req, res, {status: 'Token NOT validated!'})
        }
        else{
            res.redirect('/')
        }
    })

    app.get('/newSingupToken', async (req, res) => {
        res.render('main', {page: 'newToken', params: { csrfToken: req.csrfToken() } })
    })

    app.post('/newSingupToken', validateNewSingupToken, async (req, res) => {
        if(req.body.email){
            const user = await User.newConfirmToken(req.body.email)
            if(user && user.confirmToken){
                sendConfirmEmail(user)
                return goHome(req, res, {status: 'New confirmation email sent'})
            }
            else return goHome(req, res, {status: 'Error sending new confirmation email'})

        }
        else{
            res.redirect('/')
        }
    })

    app.get('/upload', AuthMiddleware, (req, res) => {
        res.render('main', {page: 'upload', params: { csrfToken: req.csrfToken() } })
    })

    app.post('/video', validateVideoInput, AuthMiddleware, (req, res) => {
        const file = req.files.file
        const fileName = req.body.fileName
        const categories = req.body.categories

        file.mv(fileName, async (err) => {
            if(err){
                console.log('Error: failed to download the file')
                return res.status(500).send(err)
            }

            await ffmpeg(fileName).addOptions([ 
                '-hls_time 10',
                '-hls_segment_filename streamable/part_%03d.ts',
                '-hls_playlist_type vod'
            ]).output('streamable/master.m3u8').on('end', async () => {
                await ipfs.files.mkdir(`/videos/${fileName}` , {parents: true});

                fs.readdir('./streamable/', async (err, files) => {
                    for await (const f of files){
                        console.log(f);
                        const fromPath = Path.join( './streamable', f );
                        const stat = await fs.promises.stat( fromPath );
                        if( stat.isFile() ){
                            const filecontent = fs.readFileSync(fromPath)
                            console.log(`writing ipfs file: /videos/${fileName}/${f}`)
                            await ipfs.files.write(`/videos/${fileName}/${f}`, filecontent, { create: true })
                            fs.rmSync(fromPath)
                        }

                    }

                    await ffmpeg(fileName).takeScreenshots({
                        count: 1,
                        timemarks: [ '5' ] 
                    }, 'streamable').on('end', async (err) => {

                        if(err) console.log('Error generating thumbnail from video')
                        console.log('screenshots were saved')
                        const filecontent = fs.readFileSync('streamable/tn.png')
                        await ipfs.files.write(`/videos/${fileName}/thumb.png`, filecontent, { create: true })
                      
                        dirStat = await ipfs.files.stat(`/videos/${fileName}`)
                        dirCid = dirStat.cid.toString()
                        console.log(`dir cid: ${dirCid}`)
                        fs.rmSync('streamable/tn.png')
                        await File.persist(fileName, dirCid, undefined)

                        for(const category of categories.split(',')){
                            await File.associate(category.trim(), dirCid)
                        }

                        return dirStat.cid.toString();
                    })

                    rootStat = await ipfs.files.stat(`/`)
                    console.log(`root cid: ${rootStat.cid.toString()}`)
                    fs.rmSync(fileName)

                });

            }).run()   
               
            return goHome(req, res, {status: `Uploading video ${fileName} to streamable format`, user: req.user })
        })

    })

    app.get('/forgotPassword', (req,res) => {
        if(req.query.token){
            res.render('main', {page: 'forgotPassword', params: {csrfToken: req.csrfToken(), token: req.query.token} })
        } else {
            res.render('main', {page: 'forgotPassword', params: {csrfToken: req.csrfToken()} })
        }
    })

    app.post('/requestResetPassword', validateResetPassword, async (req,res) => {
        const user = await User.resetPasswordToken(req.body.email) 
        sendEmailResetPassword(user)
        return goHome(req, res, {})
    })

    app.post('/resetPassword', validateForgotPassword, async (req,res) => {
        const user = await User.resetPassword(req.body.password, req.body.passwordResetToken)
        if(user){
            return goHome(req, res, {user})
        } else {
            return goHome(req, res, {status: 'Error reseting password'})
        }
    })

    app.post('/changeProfilePhoto', AuthMiddleware, /* validateUpdateImage, */ async (req,res) => {

        const image = req.files.image
        await image.mv('imagefile', async (err) => {
            if(err){
                console.log('Error: failed to download the file')
                return res.status(500).send(err)
            }

            imgCid = await addFile('imagefile')
            req.user = await User.updateProfilePhoto(req.user, imgCid) 

            fs.rmSync('imagefile')
            return res.render('main', {page: 'profile', params: { csrfToken: req.csrfToken(), user: req.user }})

        })


    })

    const addFile = async (fileName, wrapWithDirectory=false) => {
        const file = fs.readFileSync(fileName)
        const fileAdded = await ipfs.add({path: fileName, content: file}, { wrapWithDirectory })
        console.log('added file cid ' + fileAdded.cid.toString())
        return fileAdded.cid.toString();
    }

    const sendEmailResetPassword = (user) => {
        console.log(`Sending confirmation email to ${user.email}`)
          
        const mailOptions = {
          from: process.env.FROM_EMAIL,
          to: user.email,
          subject: 'Reset password',
          html: `<p><a href="http://127.0.0.1:3000/forgotPassword?token=${user.resetToken.token}">Click here</a> to reset your password</p>`
        };
        
        transporter.sendMail(mailOptions, function(error, info){
          if (error) {
            console.log(error);
          } else {
            console.log('Email sent: ' + info.response);
          }
        });
    }

    const sendConfirmEmail = (user) => {
        console.log(`Sending confirmation email to ${user.email}`)
          
        const mailOptions = {
          from: process.env.FROM_EMAIL,
          to: user.email,
          subject: 'Confirm register',
          html: `<p><a href="http://127.0.0.1:3000/validateSingupToken?token=${user.confirmToken.token}">Click here</a> to confirm your registration</p>`
        };
        
        transporter.sendMail(mailOptions, function(error, info){
          if (error) {
            console.log(error);
          } else {
            console.log('Email sent: ' + info.response);
          }
        });

    }

    db.sync().then(() => {
        app.listen(3000, () => {
            console.log('Server listening on 3000')
        })
    
    })

/* 
    const bufferedContents = await toBuffer(ipfs.cat('QmWCscor6qWPdx53zEQmZvQvuWQYxx1ARRCXwYVE4s9wzJ')) // returns a Buffer
    const stringContents = bufferedContents.toString() // returns a string
    console.log(`QmWCscor6qWPdx53zEQmZvQvuWQYxx1ARRCXwYVE4s9wzJ: ${stringContents}`) */
    
}

main()