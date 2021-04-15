const IPFS = require('ipfs');
const express = require('express');
const fileUpload = require('express-fileupload')
//const toBuffer = require('it-to-buffer')
const all = require('it-all')
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const fs = require('fs');
const Path = require('path');

/* ffmpeg(filename).addOptions([ 
    '-hls_time 10',
    '-hls_segment_filename videos/360p_%03d.ts',
    '-hls_playlist_type vod'
]).output('videos/master.m3u8').run() */

async function main () {
    const ipfs = await IPFS.create({silent: true})
    const app = express()
    
    app.set('view engine', 'ejs')
    app.use(express.json())
    app.use(express.urlencoded({ extended: true}))

    app.use(fileUpload())
    
    app.use(express.static(__dirname + '/public'));

    app.get('/', (req, res) => {
        res.render('home')
    })

    app.get('/watch', (req, res) => {
        res.render('watch', { fileHash: req.query.filehash, fileName: req.query.filename })
    })

    app.post('/upload', (req, res) => {
        const file = req.files.file
        const fileName = req.body.fileName

        file.mv(fileName, async (err) => {
            if(err){
                console.log('Error: failed to download the file')
                return res.status(500).send(err)
            }

            ffmpeg(fileName).addOptions([ 
                '-hls_time 10',
                '-hls_segment_filename streamable/part_%03d.ts',
                '-hls_playlist_type vod'
            ]).output('streamable/master.m3u8').on('end', () => {
                fs.readdir('./streamable/', async (err, files) => {

                    files.forEach(async file => {
                      console.log(file);
                      const fromPath = Path.join( './streamable', file );
                      const stat = await fs.promises.stat( fromPath );
                      if( stat.isFile() ){
                        const filecontent = fs.readFileSync(fromPath)
                        await ipfs.files.write(`/${file}`, filecontent, { create: true })
                        fs.rmSync(fromPath)
                        }
                    }); 
                    dirStat = await ipfs.files.stat('/')
                    console.log(`dir cid: ${dirStat.cid.toString()}`)
    
                });


            }).run() /*.on('data', (chunk) => {
                console.log('uploading ' + chunk.length + ' of data')
                ipfs.files.write(`/${fileName}/`, chunk, { create: true });

            })*/

            const fileHash = await addFile(fileName,true)

            fs.unlink(fileName, (err) => {
                if(err) console.log(err)
            })
            res.render('upload', {fileName, fileHash})
        })

    })

    const addFile = async (fileName, wrapWithDirectory=false) => {
        const file = fs.readFileSync(fileName)
        const fileAdded = await ipfs.add({path: fileName, content: file}, { wrapWithDirectory })
        console.log('added file cid ' + fileAdded.cid.toString())
        return fileAdded.cid.toString();
    }

    app.listen(3000, () => {
        console.log('Server listening on 3000')
    })
/* 
    const bufferedContents = await toBuffer(ipfs.cat('QmWCscor6qWPdx53zEQmZvQvuWQYxx1ARRCXwYVE4s9wzJ')) // returns a Buffer
    const stringContents = bufferedContents.toString() // returns a string
    console.log(`QmWCscor6qWPdx53zEQmZvQvuWQYxx1ARRCXwYVE4s9wzJ: ${stringContents}`) */
    
}

main()