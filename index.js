const IPFS = require('ipfs');
const express = require('express');
const fileUpload = require('express-fileupload')
const fs = require('fs');
const Path = require('path');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
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
    File,
    doDbMaintenance,
    FilePendingDeletion} = require('./persistence/models')

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
const validateSingupToken = require('./middleware/validateSingupToken')

const {goPage} = require('./utils')

const {getHomepage, goWatch, terms, about, noScript} = require('./controllers/Home')

const {login,singup,profile,changePassword,getLogin,postLogout,postSingup,
    postNewSingupToken,getValidateSingupToken,getNewSingupToken,getForgotPassword,
    postRequestResetPassword,postResetPassword, postChangeUserData, postDeleteUser,getUser} = require('./controllers/User')

const {getUpload, postVideo, postUploadCid, postChangeProfilePhoto, postDeleteFile,
    postSearch, postReact,postReindex,postReportCid} = require('./controllers/File')

const {postComment, postDeleteComment} = require('./controllers/Comment')
const {postDeleteReport} = require('./controllers/Report')
    
async function main () {
    const app = express()

    const repoPath = '.ipfs-node-main'
    const ipfs = await IPFS.create({silent: true, repo: repoPath })

    const addStaticData = (req,res,next) => {
        if(!req.ipfs){
            req.ipfs = ipfs
        }
        if(!req.streamableDir){
            req.streamableDir = streamableDir
        }
        if(!req.imagesDir){
            req.imagesDir = imagesDir
        }
        
        next()
    };

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


    app.get('/randomVideos', async(req,res) => {
        try{
            const vids = await File.getRandomCids();
            return res.status(200).json(vids)
        } catch(err){
            console.log('app.get/randomVideos error ' + err)
            return res.status(500).json({})
        }

    })

    app.get('/', getLoggedUser, getHomepage)

    app.get('/singup', getLoggedUser, singup)

    app.get('/profile', AuthMiddleware, profile)
    
    app.post('/changePassword', AuthMiddleware, validateChangePassword, changePassword)

    app.get('/login', getLoggedUser, getLogin)

    app.post('/login', validateLogin, login)

    app.post('/logout', AuthMiddleware, postLogout);

    app.post('/singup', validateSingUp, postSingup)
    
    app.get('/watch', getLoggedUser, validateGetWatch, goWatch)

    app.get('/validateSingupToken', validateSingupToken, getValidateSingupToken)

    app.get('/newSingupToken', getNewSingupToken)

    app.post('/newSingupToken', validateNewSingupToken, postNewSingupToken)

    app.get('/upload', AuthMiddleware, getUpload)

    app.post('/video', validateVideoInput, AuthMiddleware, addStaticData, postVideo)

    app.get('/forgotPassword', getForgotPassword)

    app.post('/requestResetPassword', validateResetPassword, postRequestResetPassword)

    app.post('/resetPassword', validateForgotPassword, postResetPassword)

    app.post('/changeProfilePhoto', AuthMiddleware, validateUpdateImage, addStaticData, postChangeProfilePhoto)

    app.post('/comment', AuthMiddleware, validateFileComment, postComment)

    app.post('/deleteComment', AuthMiddleware, validateDeleteComment, postDeleteComment)

    app.post('/deleteFile', AuthMiddleware, validateDeleteFile, postDeleteFile)

    app.post('/changeUserData', AuthMiddleware, validateChangeUserData, postChangeUserData)

    app.post('/search', validateSearch, getLoggedUser, postSearch)

    app.get('/terms', getLoggedUser, terms)

    app.post('/deleteUser', AuthMiddleware, validateDeleteUser, postDeleteUser)

    app.get('/user/:id', validateGetUser, getLoggedUser, getUser)

    app.post('/react', AuthMiddleware, validateReact,  postReact)

    app.post('/reindex', AuthMiddleware, postReindex)

    app.get('/about', getLoggedUser, about)

    app.get('/noscript', noScript)

    app.post('/uploadCid', validateUploadCid, AuthMiddleware, postUploadCid)

    app.post('/reportCid', AuthMiddleware, validateReportCid,  postReportCid)

    app.post('/deleteReport', AuthMiddleware, validateDeleteReport,  postDeleteReport)


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