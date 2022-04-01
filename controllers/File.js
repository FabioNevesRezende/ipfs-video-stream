const Path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const https = require('https')
require('dotenv').config()

const {File,User,Userpendingupload,FilePendingDeletion,UserFileRepeat} = require('../persistence/models')

const {goPage} = require('./Root')
const {goHome} = require('./Home')
const {goProfile} = require('./User')

const pinFile = async (ipfs, fileHash) => {
    console.log('pinFile cid: ' + fileHash)
    await ipfs.pin.add(fileHash, {recursive: true})

}

const addFile = async (ipfs, fileName, wrapWithDirectory=false) => {
    const file = fs.readFileSync(fileName)
    const fileAdded = await ipfs.add({content: file}, { wrapWithDirectory })
    fileCid = fileAdded.cid.toString()
    console.log('added file cid ' + fileCid)
    return fileCid;
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

// EXPORTS:
const getUpload = (req, res) => {
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
}

const postVideo = (req, res) => {
    try{
        const file = req.files.file
        const fileName = req.body.fileName
        const categories = req.body.categories
        const description = req.body.description
        const ipfs = req.ipfs 
        const streamableDir = req.streamableDir 
        
        file.mv(fileName, async (err) => {
            try{
                if(err){
                    console.log('Error: failed to download the file')
                    return goPage('error', req, res, { errorMessage: 'Error: failed to download the file' })
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
                                        await pinFile(ipfs, fileCid)
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
                                        await pinFile(ipfs, fileCid)
                                        requestCidToIpfsNetwork(fileCid)
                                    
                                        dirStat = await ipfs.files.stat(`/videos/${fileName}`)
                                        dirCid = dirStat.cid.toString()
                                        console.log(`dir cid: ${dirCid}`)
                                        await pinFile(ipfs, dirCid)
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
}

const postUploadCid = async (req, res) => {
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
}


const postChangeProfilePhoto = async (req,res) => {
    try{
        const image = req.files.image
        const currentImg = Path.join(req.imagesDir, 'imagefile-' + req.user.username)
        if(image.size > 1024 * 1024){
            return goPage('error', req, res, { errorMessage: 'Maximum file size: 1 MB' })
        }

        await image.mv(currentImg, async (err) => {
            if(err){
                console.log('Error: failed to download the file')
                return res.status(500).send(err)
            }

            imgCid = await addFile(req.ipfs, currentImg)

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


}

const postDeleteFile = async(req, res) => {
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
}

const postSearch = async(req,res) => {
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

}

const postReact = async (req, res) => {
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
}

const postReindex = async (req, res) => {
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
}

const postReportCid = async (req, res) => {
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
}

module.exports = {
    getUpload, postVideo, postUploadCid, postChangeProfilePhoto, postDeleteFile,
    postSearch, postReact, postReindex, postReportCid
}