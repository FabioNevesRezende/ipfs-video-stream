const isCidRegex = (cid) => {
    regex=/^Qm[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{44}$/g

    let matches = cid.match(regex) || [];
    if(matches.length > 0){
        return 1;
    } 
    throw new Error("not a valid cid");
}

const hasCidThumb = async (cid, ipfs) => {
    for await (const file of ipfs.get(`${cid}/thumb.png`)) {
        console.log(file.type, file.path)
      
        if (!file.content) throw new Error("Empty thumbnail");;
      
        //137 80 78 71 13 10 26 10

        if(file.content[0][0] == 137 && 
           file.content[0][1] == 80  && 
           file.content[0][2] == 78  && 
           file.content[0][3] == 71  && 
           file.content[0][4] == 13  && 
           file.content[0][5] == 10  && 
           file.content[0][6] == 26  && 
           file.content[0][7] == 10 )
           return 1;

        throw new Error("not a valid cid");
      }
}

const validateCid = (cid, ipfs) => {
    isCidRegex(cid)
    hasCidThumb(cid, ipfs)
    //hasCidMasterm3u8(cid)
    //hasCidPart000(cid)

}

module.exports.isCidRegex = isCidRegex;
module.exports.validateCid = validateCid;