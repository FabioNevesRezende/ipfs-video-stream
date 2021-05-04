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
const {User,File,Comment,Userpendingupload,doDbMaintenance} = require('./persistence/models')
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
const validateFileComment = require('./middleware/validateFileComment')
const validateDeleteComment = require('./middleware/validateDeleteComment')
const validateDeleteFile = require('./middleware/validateDeleteFile')
const validateChangeUserData = require('./middleware/validateChangeUserData')

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
        console.log('vids')
        console.log(JSON.stringify(vids))
        return res.render('main', {page: 'home', params: {...args, csrfToken: req.csrfToken(), vids }})

    } 

    const goProfile = async (req, res, args) => {
        const user = await User.withProfileData(req.user.id)
        return res.render('main', {page: 'profile', params: {...args, csrfToken: req.csrfToken(), user }})
    }

    app.get('/', getLoggedUser, async (req, res) => {
        try{
            return goHome(req, res, {user: req.user})
        } catch(err){
            console.log('app.get/ error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }
    })

    app.get('/singup', getLoggedUser, (req, res) => {
        try{
            if(req.user){
                return goHome(req, res, {user: req.user})
            }
            return res.render('main', {page: 'singup', params: {csrfToken: req.csrfToken()}})
        } catch(err){
            console.log('app.get/singup error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }
    })

    app.get('/profile', AuthMiddleware, async (req, res) => {
        try{
            if(!req.user){
                return goHome(req, res, {})
            }
            return goProfile(req, res, {})
        } catch(err){
            console.log('app.get/profile error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }
    })
    
    app.post('/changePassword', AuthMiddleware, validateChangePassword, async (req, res) => {
        try{
            const changed = await req.user.changePassword(req.body.password, req.body.newPassword)
            if(changed) 
                return goProfile(req, res, {})
            else return goHome(req, res, {status: 'Error changing user password'})
        } catch(err){
            console.log('app.post/changePassword error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }
    })

    app.get('/login', getLoggedUser, (req, res) => {
        try{
            if(req.user){
                return goHome(req, res, {user: req.user})
            }
            res.render('main', {page: 'login', params: {csrfToken: req.csrfToken()}})
        } catch(err){
            console.log('app.get/login error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }
    })

    app.post('/login', validateLogin, async (req, res) => {

        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid request' }});
            }

            let user = await User.authenticate(username, password)
            if(user){
                console.log('returned user: ' + JSON.stringify(user))
                if(!user.confirmed)
                    return goHome(req, res, {status: 'User email not confirmed'})

                res.cookie('authToken', user.authToken, { maxAge: 8320000, httpOnly: true });

                return goHome(req, res, {user})
            } else console.log('Usuário não autenticado')

        } catch (err) {
            console.log('app.post/login error ' + err)
            return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid credentials' }});
        }

    })

    app.post('/logout', AuthMiddleware, async (req, res) => {
        try{
            const { user, cookies: { authToken: authToken } } = req
        
            if (user && authToken) {
                await User.logout(authToken);
                return goHome(req, res, {})
            }

            return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid request' }});
        } catch(err){
            console.log('app.post/logout error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }

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
            console.log('app.post/singup error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Invalid credentials' }});
        }

    })
    
    app.get('/watch', getLoggedUser, async (req, res) => {
        try{
            const c = await Comment.ofFile(req.query.filehash)
            res.render('main', {page: 'watch', params: { 
                comments: c,
                fileHash: req.query.filehash,
                fileName: req.query.filename,
                csrfToken: req.csrfToken()
            }})

        } catch(err){
            console.log('app.get/watch error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }
    })

    app.get('/validateSingupToken', async (req, res) => {
        try{
            if(req.query.token){
                if(await User.validateSingup(req.query.token))
                    return goHome(req, res, {status: 'Token validated!'})
                else
                    return goHome(req, res, {status: 'Token NOT validated!'})
            }
            else{
                res.redirect('/')
            }
                
        } catch(err){
            console.log('app.get/validateSingupToken error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }

    })

    app.get('/newSingupToken', async (req, res) => {
        try{
            res.render('main', {page: 'newToken', params: { csrfToken: req.csrfToken() } })
        } catch(err){
            console.log('app.get/newSingupToken error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }
    })

    app.post('/newSingupToken', validateNewSingupToken, async (req, res) => {
        try{
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
        } catch(err){
            console.log('app.post/newSingupToken error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }

    })

    app.get('/upload', AuthMiddleware, (req, res) => {
        try{
            res.render('main', {page: 'upload', params: { csrfToken: req.csrfToken() } })
        } catch(err){
            console.log('app.get/upload error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }
    })

    app.post('/video', validateVideoInput, AuthMiddleware, (req, res) => {
        try{
            const file = req.files.file
            const fileName = req.body.fileName
            const categories = req.body.categories

            file.mv(fileName, async (err) => {
                if(err){
                    console.log('Error: failed to download the file')
                    return res.status(500).send(err)
                }
                const tempDir = Path.join('streamable', fileName).replace(/(\s+)/g, '-')
                const pendingId = await Userpendingupload.newUpload(req.user.id, fileName)

                try{
                    fs.mkdirSync(tempDir)
                } catch(err){
                    if(err.code === 'EEXIST')
                        console.log('file already exists')
                }
                await ffmpeg(fileName).addOptions([ 
                    '-hls_time 10',
                    `-hls_segment_filename ${tempDir}/part_%03d.ts`,
                    '-hls_playlist_type vod'
                ]).output(`${tempDir}/master.m3u8`).on('end', async () => {
                    await ipfs.files.mkdir(`/videos/${fileName}` , {parents: true});

                    fs.readdir(`./${tempDir}`, async (err, files) => {
                        if(err){
                            console.log('app.post/video error ' + err)
                        }
                        for await (const f of files){
                            console.log(f);
                            const fromPath = Path.join( `./${tempDir}`, f );
                            const stat = await fs.promises.stat( fromPath );
                            if( stat.isFile() ){
                                const filecontent = fs.readFileSync(fromPath)
                                console.log(`writing ipfs file: /videos/${fileName}/${f}`)
                                await ipfs.files.write(`/videos/${fileName}/${f}`, filecontent, { create: true })
                            }

                        }

                        await ffmpeg(fileName).takeScreenshots({
                            count: 1,
                            timemarks: [ '5' ] 
                        }, tempDir).on('end', async (err) => {

                            if(err) console.log('Error generating thumbnail from video')
                            console.log('screenshots were saved')
                            const filecontent = fs.readFileSync(`${tempDir}/tn.png`)
                            await ipfs.files.write(`/videos/${fileName}/thumb.png`, filecontent, { create: true })
                        
                            dirStat = await ipfs.files.stat(`/videos/${fileName}`)
                            dirCid = dirStat.cid.toString()
                            console.log(`dir cid: ${dirCid}`)
                            await pinFile(dirCid)
                            await File.persist(fileName, dirCid, req.user.id)
                            for(const category of categories.split(',')){
                                await File.associate(category.trim(), dirCid)
                            }

                            fs.rmSync(tempDir, {recursive: true})
                            fs.rmSync(fileName)
                            Userpendingupload.done(pendingId)
                            return dirStat.cid.toString();
                        })

                        rootStat = await ipfs.files.stat(`/`)
                        console.log(`root cid: ${rootStat.cid.toString()}`)

                    });

                }).run()   
                
                return res.redirect('/profile')
            })
        } catch (err){
            console.log('app.post/video error ' + err)
        }
    })

    app.get('/forgotPassword', (req,res) => {
        try{
            if(req.query.token){
                res.render('main', {page: 'forgotPassword', params: {csrfToken: req.csrfToken(), token: req.query.token} })
            } else {
                res.render('main', {page: 'forgotPassword', params: {csrfToken: req.csrfToken()} })
            }
        } catch(err){
            console.log('app.get/forgotPassword error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }

    })

    app.post('/requestResetPassword', validateResetPassword, async (req,res) => {
        try{
            const user = await User.resetPasswordToken(req.body.email) 
            sendEmailResetPassword(user)
            return goHome(req, res, {})
        } catch(err){
            console.log('app.post/requestResetPassword error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }
    })

    app.post('/resetPassword', validateForgotPassword, async (req,res) => {
        try{
            const user = await User.resetPassword(req.body.password, req.body.passwordResetToken)
            if(user){
                return goHome(req, res, {user})
            } else {
                return goHome(req, res, {status: 'Error reseting password'})
            }
        } catch(err){
            console.log('app.post/resetPassword error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }

    })

    app.post('/changeProfilePhoto', AuthMiddleware, validateUpdateImage, async (req,res) => {
        try{
            const image = req.files.image
            await image.mv('imagefile', async (err) => {
                if(err){
                    console.log('Error: failed to download the file')
                    return res.status(500).send(err)
                }

                imgCid = await addFile('imagefile')
                req.user = await User.updateProfilePhoto(req.user, imgCid) 

                fs.rmSync('imagefile')
                return goProfile(req, res, {})

            })
        } catch(err){
            console.log('app.post/changeProfilePhoto error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Internal error' }});
        }


    })

    app.post('/comment', AuthMiddleware, validateFileComment, async (req, res) => {
        try {
            let comment = await Comment.createNew(req.body.commentText, req.user.id, req.body.cid)
            if(comment){
                res.redirect(req.header('Referer') || '/')
            }
            else {
                throw new Error('Invalid comment')
            }
            
        } catch(err) {
            console.log('app.post/comment error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Error creating new comment' }});
        }
    })

    app.post('/deleteComment', AuthMiddleware, validateDeleteComment, async (req, res) => {
        try{
            await Comment.remove(req.body.commentId, req.user.id) 
            res.redirect(req.header('Referer') || '/')

        } catch(err){
            console.log('app.post/deleteComment error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Error deleting comment' }});
        }
    })

    app.post('/deleteFile', AuthMiddleware, validateDeleteFile, async(req, res) => {
        try{
            const f = await File.findOne({ where: { cid: req.body.cid } })
            if(f?.userId === req.user.id){
                await File.delete(f.cid)
                return res.redirect(req.header('Referer') || '/')

            }
            throw new Error("Could not delete file, invalid userId")
        }catch(err){
            console.log('app.post/deleteFile error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Error deleting file' }});
        }
    })

    app.post('/changeUserData', AuthMiddleware, validateChangeUserData, async(req, res) => {
        try{
            req.user.username = req.body.username
            req.user.email = req.body.email

            if(await User.updateData(req.user, req.body.password)){
                return res.redirect(req.header('Referer') || '/')

            }
            throw new Error("Could not update user data")
        }catch(err){
            console.log('app.post/changeUserData error ' + err)
            return res.status(500).render('main', { page: 'error', params: { errorMessage: 'Error processing request' }});
        }
    })

    const addFile = async (fileName, wrapWithDirectory=false) => {
        const file = fs.readFileSync(fileName)
        const fileAdded = await ipfs.add({path: fileName, content: file}, { wrapWithDirectory })
        fileCid = fileAdded.cid.toString()
        console.log('added file cid ' + fileCid)
        pinFile(fileCid)
        return fileCid;
    }

    const pinFile = async (fileHash) => {
        console.log('pinFile cid: ' + fileHash)
        await ipfs.pin.add(fileHash)

    }

    const sendEmailResetPassword = (user) => {
        try{
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
        } catch(err){
            console.log('sendEmailResetPassword error: ' + err)
        }

    }

    const sendConfirmEmail = (user) => {
        try{
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
        } catch(err){
            console.log('sendConfirmEmail error: ' + err)
        }
    }

    db.sync().then(() => {
        app.listen(3000, () => {
            console.log('Server listening on 3000')
        })
    
    })

    setInterval(doDbMaintenance, 86400)
/* 
    const bufferedContents = await toBuffer(ipfs.cat('QmWCscor6qWPdx53zEQmZvQvuWQYxx1ARRCXwYVE4s9wzJ')) // returns a Buffer
    const stringContents = bufferedContents.toString() // returns a string
    console.log(`QmWCscor6qWPdx53zEQmZvQvuWQYxx1ARRCXwYVE4s9wzJ: ${stringContents}`) */
    
}

main()