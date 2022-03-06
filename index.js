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
const https = require('https')
const cors = require('cors')
require('dotenv').config()

const streamableDir = Path.join(__dirname, 'streamable')
const imagesDir = Path.join(__dirname, 'imgs')

if (!fs.existsSync(streamableDir)) {
    fs.mkdirSync(streamableDir)
    console.log(`streamable dir created: ${streamableDir}`)
}

if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir)
    console.log(`imagesDir dir created: ${imagesDir}`)
}

const db = require('./persistence/db')
const {
    User,
    File,
    Comment,
    Userpendingupload,
    doDbMaintenance,
    FilePendingDeletion,
    UserFileRepeat,
    Report} = require('./persistence/models')

const AuthMiddleware = require('./middleware/auth')
const validateVideoInput = require('./middleware/validateVideoInput')
const validateSingUp = require('./middleware/validateSingup')
const validateLogin = require('./middleware/validateLogin')
const getLoggedUser = require('./middleware/getLoggedUser')
const handleCsrfError = require('./middleware/handleCsrfError');
const validateGetWatch = require('./middleware/validateGetWatch');
const validateNewSingupToken = require('./middleware/validateNewSingupToken')
const validateForgotPassword = require('./middleware/validateForgotPassword') 
const validateResetPassword  = require('./middleware/validateResetPassword') 
const validateChangePassword  = require('./middleware/validateChangePassword') 
const validateUpdateImage = require('./middleware/validateUpdateImage')
const validateFileComment = require('./middleware/validateFileComment')
const validateDeleteComment = require('./middleware/validateDeleteComment')
const validateDeleteFile = require('./middleware/validateDeleteFile')
const validateChangeUserData = require('./middleware/validateChangeUserData')
const validateSearch = require('./middleware/validateSearch')
const validateDeleteUser = require('./middleware/validateDeleteUser')
const validateGetUser = require('./middleware/validateGetUser')
const validateReact = require('./middleware/validateReact')
const validateUploadCid = require('./middleware/validateUploadCid')
const validateReportCid = require('./middleware/validateReportCid')
const validateDeleteReport = require('./middleware/validateDeleteReport')
var sgTransport = require('nodemailer-sendgrid-transport');

const {goPage, sleep} = require('./utils')

const LIKE = 0
const DISLIKE = 1

async function main () {
    const repoPath = '.ipfs-node-main'
    const ipfs = await IPFS.create({silent: true, repo: repoPath })
    const app = express()

    var transporter = nodeMailer.createTransport(sgTransport({
        auth: {
            api_key: process.env.SENDGRID_API_KEY
        }
      }
      ));


    const csrfMiddleware = csurf({
        cookie: true
    });
    
    app.set('view engine', 'ejs')
    app.use(express.json())
    app.use(express.urlencoded({ extended: true}))
    
    app.use(cookieParser());

    app.use(fileUpload({
        limits: { fileSize: 500 * 1024 * 1024 },
        limitHandler: function(req, res){
            return goPage('error', req, res, { errorMessage: 'Maximum file size: 500 MB' })

        }
      }));
    
    app.use(express.static(__dirname + '/public'));
    app.use(csrfMiddleware);
    app.use(handleCsrfError)
    app.use(cors())

    const goHome = async (req, res, args) => {
        if(!args.vids){
            const vids = await File.getVideosHomePage();
            console.log('vids')
            console.log(JSON.stringify(vids))
            args.vids = vids;
        }

        return goPage('home', req, res, {...args, csrfToken: req.csrfToken() })

    } 

    const goProfile = async (req, res, args) => {
        const user = await User.withProfileData(req.user.id)
        user.files = user.files.concat(await UserFileRepeat.allByUserId(req.user.id))
        return goPage('profile', req, res, {...args, csrfToken: req.csrfToken(), user })
    }

    app.get('/randomVideos', async(req,res) => {
        try{
            const vids = await File.getRandomCids();
            return res.status(200).json(vids)
        } catch(err){
            console.log('app.get/randomVideos error ' + err)
            return res.status(500).json({})
        }

    })

    app.get('/', getLoggedUser, async (req, res) => {
        try{
            return goHome(req, res, {user: req.user})
        } catch(err){
            console.log('app.get/ error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }
    })

    app.get('/singup', getLoggedUser, (req, res) => {
        try{
            if(req.user){
                return goHome(req, res, {user: req.user})
            }
            return goPage('singup', req, res, {csrfToken: req.csrfToken()})
        } catch(err){
            console.log('app.get/singup error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
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
            return goPage('error', req, res, { errorMessage: 'Internal error' })
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
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }
    })

    app.get('/login', getLoggedUser, (req, res) => {
        try{
            if(req.user){
                return goHome(req, res, {user: req.user})
            }
            return goPage('login', req, res, {csrfToken: req.csrfToken()})
        } catch(err){
            console.log('app.get/login error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }
    })

    app.post('/login', validateLogin, async (req, res) => {

        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return goPage('error', req, res, { errorMessage: 'Invalid request' }, 403)
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
            return goPage('error', req, res, { errorMessage: 'Invalid credentials' }, 401)
        }

    })

    app.post('/logout', AuthMiddleware, async (req, res) => {
        try{
            const { user, cookies: { authToken: authToken } } = req
        
            if (user && authToken) {
                await User.logout(authToken);
                return goHome(req, res, {})
            }

            return goPage('error', req, res, { errorMessage: 'Invalid request' })
        } catch(err){
            console.log('app.post/logout error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
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
            return goPage('error', req, res, { errorMessage: 'Invalid credentials' })
        }

    })
    
    app.get('/watch', getLoggedUser, validateGetWatch, async (req, res) => {
        try{
            const f = await File.getByCid(req.query.filehash)
            if(f){
                f.filereactions = await File.reactions(req.query.filehash)
                console.log('user: ')
                console.log(JSON.stringify(req.user))

                if(req.user){
                    for(const r of f.filereactions){
                        if(r.userId === req.user.id && r.num === LIKE) 
                            req.user.liked = true
                        if(r.userId === req.user.id && r.num === DISLIKE) 
                            req.user.disliked = true
                    }
                }
                const alsoPostedBy = await UserFileRepeat.allByFileCid(req.query.filehash)
                return goPage('watch', req, res, { 
                    file: f,
                    csrfToken: req.csrfToken(),
                    user: req.user,
                    alsoPostedBy
                })

            }
            return goPage('error', req, res, { errorMessage: 'File not indexed' })
            
        } catch(err){
            console.log('app.get/watch error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
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
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }

    })

    app.get('/newSingupToken', async (req, res) => {
        try{
            return goPage('newToken', req, res, { csrfToken: req.csrfToken() })
        } catch(err){
            console.log('app.get/newSingupToken error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
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
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }

    })

    app.get('/upload', AuthMiddleware, (req, res) => {
        try{
            res.set({
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp'
            })
            return goPage('upload', req, res, { csrfToken: req.csrfToken(), user: req.user })
        } catch(err){
            console.log('app.get/upload error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }
    })

    app.post('/video', validateVideoInput, AuthMiddleware, (req, res) => {
        try{
            const file = req.files.file
            const fileName = req.body.fileName
            const categories = req.body.categories
            const description = req.body.description

            file.mv(fileName, async (err) => {
                try{
                    if(err){
                        console.log('Error: failed to download the file')
                        return res.status(500).send(err)
                    }
                    const tempDirDate = `${fileName}-${Date.now().toString()}`.replace(/(\s+)/g, '-')
                    const tempDir = Path.join(streamableDir, tempDirDate)
                    const pendingId = await Userpendingupload.newUpload(req.user.id, fileName)

                    try{
                        fs.mkdirSync(tempDir)
                    } catch(err){
                        if(err.code === 'EEXIST')
                            console.log(`file ${tempDir} already exists`)
                    }
                    FilePendingDeletion.schedule(tempDirDate)

                    ffmpeg.ffprobe(fileName, (error, metadata) => {
                        try{
                            file.duration = metadata.format.duration;
                            console.log(`Video duration: ${file.duration}`);
                        }catch(err){
                            console.log(`ffmpeg.ffprobe error: ${err}`)
                        }
                    });

                    await ffmpeg(fileName).addOptions([ 
                        '-hls_time 10',
                        `-hls_segment_filename ${tempDir}/part_%03d.ts`,
                        '-hls_playlist_type vod'
                    ]).output(`${tempDir}/master.m3u8`).on('end', async () => {
                        try{
                            await ipfs.files.mkdir(`/videos/${fileName}` , {parents: true});

                            fs.readdir(`${tempDir}`, async (err, files) => {
                                try{
                                    if(err){
                                        console.log('app.post/video error ' + err)
                                    }
                                    for await (const f of files){
                                        console.log(f);
                                        const fromPath = Path.join( `${tempDir}`, f );
                                        const stat = await fs.promises.stat( fromPath );
                                        if( stat.isFile() ){
                                            const filecontent = fs.readFileSync(fromPath)
                                            console.log(`writing ipfs file: /videos/${fileName}/${f}`)
                                            await ipfs.files.write(`/videos/${fileName}/${f}`, filecontent, { create: true })

                                            fileStat = await ipfs.files.stat(`/videos/${fileName}/${f}`)
                                            fileCid = fileStat.cid.toString()
                                            await pinFile(fileCid)
                                            requestCidToIpfsNetwork(fileCid)
                                        }

                                    }

                                    await ffmpeg(fileName).takeScreenshots({
                                        count: 1,
                                        timemarks: [ '00:00:00.001' ] 
                                    }, tempDir).on('end', async (err) => {
                                        try{
                                            if(err) console.log('Error generating thumbnail from video')
                                            console.log('screenshots were saved')
                                            const filecontent = fs.readFileSync(`${tempDir}/tn.png`)
                                            await ipfs.files.write(`/videos/${fileName}/thumb.png`, filecontent, { create: true })
                                            
                                            fileStat = await ipfs.files.stat(`/videos/${fileName}/thumb.png`)
                                            fileCid = fileStat.cid.toString()
                                            await pinFile(fileCid)
                                            requestCidToIpfsNetwork(fileCid)
                                        
                                            dirStat = await ipfs.files.stat(`/videos/${fileName}`)
                                            dirCid = dirStat.cid.toString()
                                            console.log(`dir cid: ${dirCid}`)
                                            await pinFile(dirCid)
                                            requestCidToIpfsNetwork(dirCid)
                                            const newFile = {originalFileName: fileName, cid: dirCid, op: req.user.id, description, duration: file.duration}
                                            if(!await File.persist(newFile)){
                                                UserFileRepeat.associate(req.user.id, dirCid)
                                            }
                                            await File.indexFile({...newFile, categories: categories})
                                            for(const category of categories.split(',')){
                                                await File.associate(category.trim(), dirCid)
                                            }

                                            if(req.user.hostIpfsCopy){
                                                pinCidToPinataCloud(dirCid)
                                            }

                                            fs.rmSync(fileName)
                                            Userpendingupload.done(pendingId)
                                            return dirStat.cid.toString();
                                        
                                        }catch(err){
                                            console.log('ffmpeg.takeScreenshots error: ' + err)
                                        }

                                    })

                                    rootStat = await ipfs.files.stat(`/`)
                                    console.log(`root cid: ${rootStat.cid.toString()}`)
                                }catch(err){
                                    console.log('app.post/video error running fs.readdir: ' + err)
                                }
                            });
                        }catch(err){
                            console.log('app.post/video error running ffmpeg onEnd: ' + err)
                        }
                    }).run()   
                    
                    return res.redirect('/profile')
                } catch(err){
                    console.log('file.mv error: ' + err)
                }
            })
        } catch (err){
            console.log('app.post/video error ' + err)
        }
    })

    app.get('/forgotPassword', (req,res) => {
        try{
            if(req.query.token){
                return goPage('forgotPassword', req, res, {csrfToken: req.csrfToken(), token: req.query.token})
            } else {
                return goPage('forgotPassword', req, res, {csrfToken: req.csrfToken()})
            }
        } catch(err){
            console.log('app.get/forgotPassword error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }

    })

    app.post('/requestResetPassword', validateResetPassword, async (req,res) => {
        try{
            const user = await User.resetPasswordToken(req.body.email) 
            sendEmailResetPassword(user)
            return goHome(req, res, {})
        } catch(err){
            console.log('app.post/requestResetPassword error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
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
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }

    })

    app.post('/changeProfilePhoto', AuthMiddleware, validateUpdateImage, async (req,res) => {
        try{
            const image = req.files.image
            const currentImg = Path.join(imagesDir, 'imagefile-' + req.user.username)
            if(image.size > 1024 * 1024){
                return goPage('error', req, res, { errorMessage: 'Maximum file size: 1 MB' })
            }

            await image.mv(currentImg, async (err) => {
                if(err){
                    console.log('Error: failed to download the file')
                    return res.status(500).send(err)
                }

                imgCid = await addFile(currentImg)

                if(req.user.profilePhotoCid){
                    unpinCidFromPinataCloud(req.user.profilePhotoCid)
                }

                req.user = await User.updateProfilePhoto(req.user, imgCid) 
                requestCidToIpfsNetwork(imgCid)
                pinCidToPinataCloud(imgCid)
                
                fs.rmSync(currentImg)
                
                return goProfile(req, res, {})

            })
        } catch(err){
            console.log('app.post/changeProfilePhoto error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
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
            return goPage('error', req, res, { errorMessage: 'Error creating new comment' })
        }
    })

    app.post('/deleteComment', AuthMiddleware, validateDeleteComment, async (req, res) => {
        try{
            if(req.user.adminLevel > 0){
                await Comment.removeById(req.body.commentId) 
                res.redirect(req.header('Referer') || '/')
                return
            }
            await Comment.remove(req.body.commentId, req.user.id) 
            res.redirect(req.header('Referer') || '/')

        } catch(err){
            console.log('app.post/deleteComment error ' + err)
            return goPage('error', req, res, { errorMessage: 'Error deleting comment' })
        }
    })

    app.post('/deleteFile', AuthMiddleware, validateDeleteFile, async(req, res) => {
        try{
            const f = await File.findOne({ where: { cid: req.body.cid } })
            if(f?.userId === req.user.id || req.user.adminLevel > 0){
                unpinCidFromPinataCloud(f.cid)
                await File.delete(f.cid)
                return res.redirect(req.header('Referer') || '/')

            }
            throw new Error("Could not delete file, invalid userId")
        }catch(err){
            console.log('app.post/deleteFile error ' + err)
            return goPage('error', req, res, { errorMessage: 'Error deleting file' })
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
            return goPage('error', req, res, { errorMessage: 'Error processing request' })
        }
    })

    app.post('/search', validateSearch, getLoggedUser, async(req,res) => {
        try{
            const term = req.body.term

            const vids = await File.videosFromTerm(term);
            console.log('vids')
            console.log(JSON.stringify(vids))
            goHome(req, res, {vids, user: req.user})

        }catch(err){
            console.log('app.post/search error ' + err)
            return goPage('error', req, res, { errorMessage: 'Error processing request' })
        }



    })

    app.get('/terms', getLoggedUser, async (req, res) => {
        try{
            return goPage('terms', req, res, {})
            
        } catch(err){
            console.log('app.get/terms error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }
    })

    app.post('/deleteUser', AuthMiddleware, validateDeleteUser, async (req, res) => {
        try{
            const { user, cookies: { authToken: authToken } } = req
        
            if (user?.id == req?.body?.id && authToken) {
                await User.logout(authToken);
                await User.remove(req.body.id, req.body.password)
            }
            if(req?.user?.adminLevel > 0){
                await User.remove(req.body.id)
            }

            return res.redirect('/')

        } catch(err){
            console.log('app.post/deleteUser error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }
    })

    app.get('/user/:id', validateGetUser, getLoggedUser, async (req, res) => {
        try{
            const user = await User.withProfileData(req.params.id)

            return goPage('user', req, res, { user })

        } catch(err){
            console.log('app.get/user/:id error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }


    })

    app.post('/react', AuthMiddleware, validateReact,  async (req, res) => {
        try {
            let r = await File.react(req.body.cid, req.user.id, req.body.reaction)

            if(r){
                return res.status(200).json({})
            }
            else {
                return res.status(400).json({})
            }
            
        } catch(err) {
            console.log('app.post/react error ' + err)
            return res.status(400).json({})
        }
    })

    app.post('/reindex', AuthMiddleware, async (req, res) => {
        try {
            if(req.user.adminLevel > 10){
                console.log('app.post/reindex Reindexing database files')
                await File.reindex()
                return res.status(200).redirect(req.header('Referer') || '/')

            }
            return goPage('error', req, res, { errorMessage: 'You don\'t have rights to do this operation' })
            
        } catch(err) {
            console.log('app.post/reindex error ' + err)
            return goPage('error', req, res, { errorMessage: 'Error processing request' })
        }
    })

    app.get('/about', getLoggedUser, (req, res) => {
        try{
            return goPage('about', req, res, {})
        } catch(err){
            console.log('app.get/about error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }
    })

    app.get('/noscript', (req, res) => {
        try{
            return res.status(200).render('noscript')
        } catch(err){
            console.log('app.get/noscript error ' + err)
            return goPage('error', req, res, { errorMessage: 'Internal error' })
        }
    })

    app.post('/uploadCid', validateUploadCid, AuthMiddleware, async (req, res) => {
        try {
            const categories = req.body.categories
            const cid = req.body.cid

            const newFile = {originalFileName: req.body.fileName, cid, op: req.user.id, description : req.body.description, duration : req.body.duration}
            if(!await File.persist(newFile)){
                UserFileRepeat.associate(req.user.id, dirCid)
            }
            File.indexFile({...newFile, categories})
            for(const category of categories.split(',')){
                await File.associate(category.trim(), cid)
            }
            requestCidToIpfsNetwork(cid)

            if(req.user.hostIpfsCopy){
                pinCidToPinataCloud(cid)
            }

            return res.redirect(`/watch?filehash=${cid}`)
        } catch(err) {
            console.log('app.post/uploadCid error ' + err)
            return goPage('error', req, res, { errorMessage: 'Error processing request' })
        }
    })

    app.post('/reportCid', AuthMiddleware, validateReportCid,  async (req, res) => {
        try {
            let r = await Report.register(req.user.id, undefined, req.body.cid, req.body.type)

            if(r){
                return res.status(200).json({})
            }
            else {
                return res.status(400).json({})
            }
            
        } catch(err) {
            console.log('app.post/report error ' + err)
            return res.status(400).json({})
        }
    })

    app.post('/deleteReport', AuthMiddleware, validateDeleteReport,  async (req, res) => {
        try {
            await Report.delete(req.body.id)

            return res.status(200).json({})
                        
        } catch(err) {
            console.log('app.post/deleteReport error ' + err)
            return res.status(400).json({})
        }
    })

    const addFile = async (fileName, wrapWithDirectory=false) => {
        const file = fs.readFileSync(fileName)
        const fileAdded = await ipfs.add({content: file}, { wrapWithDirectory })
        fileCid = fileAdded.cid.toString()
        console.log('added file cid ' + fileCid)
        return fileCid;
    }

    const pinFile = async (fileHash) => {
        console.log('pinFile cid: ' + fileHash)
        await ipfs.pin.add(fileHash, {recursive: true})

    }

    const requestCidToIpfsNetwork = async (cid) => {
        const options = {
          hostname: 'gateway.ipfs.io',
          port: 443,
          path: `/ipfs/${cid}`,
          method: 'GET'
        }
        
        const req = https.request(options, async res => {
          console.log(`requestCidToIpfsNetwork ${cid} statusCode: ${res.statusCode}`)
        
        //   res.on('data', d => {
        //     process.stdout.write(d)
        //   })
        })
        
        req.on('error', error => {
          console.error(error)
        })
        
        req.end()
    }

    const pinCidToPinataCloud = (cid) => {

        const data = JSON.stringify({
            hashToPin: cid
        })

        const options = {
            hostname: 'api.pinata.cloud',
            port: 443,
            path: `/pinning/pinByHash`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': data.length,
              'pinata_api_key': process.env.PINATA_API_KEY,
              'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY 
            }
        }
        
        const req = https.request(options, async res => {
          console.log(`pinCidToPinataCloud ${cid} statusCode: ${res.statusCode}`)
        
        })
        
        req.on('error', error => {
          console.error(`pinCidToPinataCloud error: ${error}`)
        })

        req.write(data)
        req.end()

    }

    const unpinCidFromPinataCloud = (cid) => {

        const options = {
            hostname: 'api.pinata.cloud',
            port: 443,
            path: `/pinning/unpin/${cid}`,
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'pinata_api_key': process.env.PINATA_API_KEY,
              'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY 
            }
        }
        
        const req = https.request(options, async res => {
          console.log(`unpinCidFromPinataCloud ${cid} statusCode: ${res.statusCode}`)
        })
        
        req.on('error', error => {
          console.error(`unpinCidFromPinataCloud error: ${error}`)
        })

        req.end()

    }

    const sendEmailResetPassword = (user) => {
        try{
            console.log(`Sending confirmation email to ${user.email}`)
            
            const mailOptions = {
            from: process.env.FROM_EMAIL,
            to: user.email,
            subject: 'Reset password',
            html: `<p><a href="${process.env.ORIGIN_NAME}/forgotPassword?token=${user.resetToken.token}">Click here</a> to reset your password</p>`
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
            html: `<p><a href="${process.env.ORIGIN_NAME}/validateSingupToken?token=${user.confirmToken.token}">Click here</a> to confirm your registration</p>`
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
        app.listen(process.env.PORT || 3000, () => {
            console.log('Server listening on 3000')
        })
    
    })

    setInterval(doDbMaintenance, 864000)    
    setInterval(() => {
        FilePendingDeletion.checkFilePendingDeletion(streamableDir)
    }, 120000)    
}

main()