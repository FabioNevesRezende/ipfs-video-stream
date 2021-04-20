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
const {User} = require('./persistence/models')
const AuthMiddleware = require('./middleware/auth')
const validateVideoInput = require('./middleware/validateVideoInput')
const validateSingUp = require('./middleware/validateSingup')
const validateLogin = require('./middleware/validateLogin')

async function main () {
    const repoPath = '.ipfs-node'  + Math.random() 
    const ipfs = await IPFS.create({silent: true, repo: repoPath })
    const app = express()
    
    app.set('view engine', 'ejs')
    app.use(express.json())
    app.use(express.urlencoded({ extended: true}))
    
    app.use(cookieParser());

    app.use(fileUpload())
    
    app.use(express.static(__dirname + '/public'));

    app.get('/', (req, res) => {
        res.render('main', {page: 'home', params: {}})
    })

    app.get('/singup', (req, res) => {
        res.render('main', {page: 'singup', params: {}})
    })

    app.get('/login', (req, res) => {
        res.render('main', {page: 'login', params: {}})
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
                res.cookie('authToken', user.authToken.token, { maxAge: 900000, httpOnly: true });

                res.render('main', {page: 'home', params: {user}})
            } else console.log('Usuário não autenticado')

        } catch (err) {
            console.log(err)
            return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid credentials' }});
        }

    })

    app.post('/logout', async (req, res) => {

        const { user, cookies: { auth_token: authToken } } = req
      
        if (user && authToken) {
          await req.user.logout(authToken);
          return res.status(204).send()
        }

        return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid request' }});
      });

    app.post('/singup', validateSingUp, async (req, res) => {

        try {
            let user = User.persist(req.body.email, req.body.username, req.body.password)
            if(user){
                res.render('main', {page: 'home', params: {} })

            }
            else {
                throw new Error('Error registering the new user, please contact the administration')
            }
            
        } catch(err) {
            console.log(err)
            return res.status(400).render('main', { page: 'error', params: { errorMessage: 'Invalid credentials' }});
        }

        //res.render('main', {page: 'home', params: {}})
    })
    
    app.get('/watch', (req, res) => {
        res.render('main', {page: 'watch', params: { fileHash: req.query.filehash, fileName: req.query.filename }})
    })

    app.get('/upload', AuthMiddleware, (req, res) => {
        res.render('main', {page: 'upload', params: {} })
    })

    app.post('/video', validateVideoInput, AuthMiddleware, (req, res) => {
        const file = req.files.file
        const fileName = req.body.fileName

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

                    rootStat = await ipfs.files.stat(`/`)
                    dirStat = await ipfs.files.stat(`/videos/${fileName}`)
                    console.log(`root cid: ${rootStat.cid.toString()}`)
                    console.log(`dir cid: ${dirStat.cid.toString()}`)
                    fs.rmSync(fileName)
    
                });

            }).run()   
               
            res.render('main', {page: 'home', params: {} })
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