const IPFS = require('ipfs');
const express = require('express');
const fileUpload = require('express-fileupload')
//const toBuffer = require('it-to-buffer')
//const all = require('it-all')
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const fs = require('fs');
const Path = require('path');
const cookieParser = require('cookie-parser');
const db = require('./persistence/db')
const {User,File,FileTag} = require('./persistence/models')
const AuthMiddleware = require('./middleware/auth')
const validateVideoInput = require('./middleware/validateVideoInput')
const validateSingUp = require('./middleware/validateSingup')
const validateLogin = require('./middleware/validateLogin')
const getLoggedUser = require('./middleware/getLoggedUser')
const csurf = require('csurf');
const handleCsrfError = require('./middleware/handleCsrfError');

async function main () {
    const repoPath = '.ipfs-node'  + Math.random() 
    const ipfs = await IPFS.create({silent: true, repo: repoPath })
    const app = express()

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
    app.get('/', getLoggedUser, async (req, res) => {
        const vids = await File.getVideos();
        res.render('main', {page: 'home', params: {csrfToken: req.csrfToken(), user: req.user, vids }})
    })

    app.get('/singup', getLoggedUser, (req, res) => {
        if(req.user){
            res.render('main', {page: 'home', params: {csrfToken: req.csrfToken(), user: req.user}})
        }
        res.render('main', {page: 'singup', params: {csrfToken: req.csrfToken()}})
    })

    app.get('/login', getLoggedUser, (req, res) => {
        if(req.user){
            res.render('main', {page: 'home', params: {csrfToken: req.csrfToken(), user: req.user}})
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
                res.cookie('authToken', user.authToken, { maxAge: 8320000, httpOnly: true });

                res.render('main', {page: 'home', params: {csrfToken: req.csrfToken(), user}})
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
            return res.render('main', { page: 'home', params: {csrfToken: req.csrfToken()}})
        }

        return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid request' }});
      });

    app.post('/singup', validateSingUp, async (req, res) => {

        try {
            let user = User.persist(req.body.email, req.body.username, req.body.password)
            if(user){
                res.render('main', {page: 'home', params: {csrfToken: req.csrfToken()} })

            }
            else {
                throw new Error('Error registering the new user, please contact the administration')
            }
            
        } catch(err) {
            console.log(err)
            return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid credentials' }});
        }

        //res.render('main', {page: 'home', params: {csrfToken: req.csrfToken()}})
    })
    
    app.get('/watch', getLoggedUser, (req, res) => {
        res.render('main', {page: 'watch', params: { fileHash: req.query.filehash, fileName: req.query.filename }})
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
                            await FileTag.associate(category.trim(), dirCid)
                        }

                        return dirStat.cid.toString();
                    })

                    rootStat = await ipfs.files.stat(`/`)
                    console.log(`root cid: ${rootStat.cid.toString()}`)
                    fs.rmSync(fileName)

                });

            }).run()   
               
            res.render('main', {page: 'home', params: {csrfToken: req.csrfToken(), user: req.user} })
        })

    })

    const addFile = async (fileName, wrapWithDirectory=false) => {
        const file = fs.readFileSync(fileName)
        const fileAdded = await ipfs.add({path: fileName, content: file}, { wrapWithDirectory })
        console.log('added file cid ' + fileAdded.cid.toString())
        return fileAdded.cid.toString();
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