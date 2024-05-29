const apiUrl = 'https://api.scryfall.com'; // Base URL of the Scryfall API
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { google } from 'googleapis';
import xlsx from 'xlsx';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';


// node src/scripts/FileReader.js


// Function to get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
const firebaseApp = initializeApp({
    apiKey: "AIzaSyCAVRElz4RmMuQD3-RQ5Ttd1w_h8MTStAc",
    authDomain: "magicproject-77014.firebaseapp.com",
    projectId: "magicproject-77014",
    storageBucket: "magicproject-77014.appspot.com",
    messagingSenderId: "1023897851903",
    appId: "1:1023897851903:web:bbcd8bdf3e81c0ac82f9ca",
});

class cardInfo {
    constructor(set, name, color, rarity, quantity, picURL, type, price) {
        this.set = set;
        this.name = name;
        this.color = color;
        this.rarity = rarity;
        this.quantity = quantity;
        this.picURL = picURL;
        this.type = type;
        this.price = price;
    }
}

function writeDataToFirebase(cardList) {
    const firestore = getFirestore();
    cardList.forEach(card => {
        const nameArray = card.name.toLowerCase().split(' ');

        var colorString = "";
        if (Array.isArray(card.color)) {
            card.color.sort();
            colorString = card.color.join('');
        }

        const docRef = doc(firestore, 'MagicCards/' + card.name + '^' + card.set);
        const docData = {
            name: card.name === undefined ? "N/A" : card.name,
            set: card.set === undefined ? "N/A" : card.set,
            color: colorString === "" ? "C" : colorString,
            rarity: card.rarity === undefined ? "N/A" : card.rarity,
            quantity: card.quantity === undefined ? 0 : parseInt(card.quantity),
            picURL: card.picURL === undefined ? "N/A" : card.picURL,
            type: card.type === undefined ? "N/A" : card.type,
            price: card.price === undefined ? "N/A" : card.price,
            nameArray: nameArray
        };
        console.log(docData);
        setDoc(docRef, docData);
    });
}

async function getScryfallBulkData() {
    try {
        console.log("Fetching Scryfall bulk data...");
        const response = await fetch(`${apiUrl}/bulk-data`);
        const data = await response.json();
        const allMagicCardsURL = data.data[0].download_uri;
        console.log("Downloading Scryfall card data...");
        const cardDataResponse = await fetch(allMagicCardsURL);
        const cardData = await cardDataResponse.json();
        console.log("Scryfall card data downloaded successfully.");
        return cardData.reduce((acc, card) => {
            acc[card.name] = {
                picURL: card.image_uris ? card.image_uris.normal : '',
                type: card.type_line,
                prices: card.prices.usd,
            };
            return acc;
        }, {});
    } catch (error) {
        console.error("Error fetching Scryfall data:", error);
        throw error;
    }
}

async function readExcelFileFromDrive(fileId, scryfallData) {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, 'credentials.json'), // Provide the path to the credentials file
            scopes: ['https://www.googleapis.com/auth/drive'],
        });
        const authClient = await auth.getClient();
        const drive = google.drive({ version: 'v3', auth: authClient });

        const response = await drive.files.get({
            fileId: fileId,
            alt: 'media',
        }, { responseType: 'arraybuffer' });

        const buffer = Buffer.from(response.data);
        const workbook = xlsx.read(buffer, { type: 'buffer' });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const jsonData = xlsx.utils.sheet_to_json(sheet);

        const cardList = [];
        jsonData.forEach(card => {
            const set = card[Object.keys(card)[0]];
            var name = card[Object.keys(card)[1]];
            const color = card['Color'];
            const rarity = card['Rarity'];
            const quantity = card[Object.keys(card)[Object.keys(card).length - 1]];
            const picURL = card['PicURL'];
            const type = card['Type'];
            const price = card['Price'];

            if (quantity === '' || quantity === undefined) {
                return;
            }

            const cardVal = parseInt(quantity);
            if (isNaN(cardVal)) {
                return;
            }

            if (!isNaN(name)) {
                name = card[Object.keys(card)[2]];
            }

            if (name === '' || name === undefined) {
                return;
            }

            const cardObj = new cardInfo(set, name, color, rarity, quantity, scryfallData[name]?.picURL || picURL, scryfallData[name]?.type || type, scryfallData[name]?.prices || price);
            cardList.push(cardObj);
        });

        console.log(`Read Excel file ${fileId} successfully.`);
        writeDataToFirebase(cardList);
    } catch (error) {
        console.error(`Error reading Excel file ${fileId}:`, error);
    }
}

async function listFilesInFolder(folderId) {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, 'credentials.json'), // Provide the path to the credentials file
            scopes: ['https://www.googleapis.com/auth/drive'],
        });
        const authClient = await auth.getClient();
        const drive = google.drive({ version: 'v3', auth: authClient });

        const response = await drive.files.list({
            q: `'${folderId}' in parents`,
            fields: 'files(id, name)',
        });

        return response.data.files;
    } catch (error) {
        console.error("Error listing files in folder:", error);
        throw error;
    }
}

async function syncFilesFromDrive() {
    try {
        const folderId = '1Jv50XfPtb9w27vtts_sycRy8TdVG-5V7'; // Replace with your Google Drive folder ID
        console.log(`Syncing files from folder ID: ${folderId}`);
        const files = await listFilesInFolder(folderId);
        console.log(`Found ${files.length} files in the folder.`);
        const scryfallData = await getScryfallBulkData();

        for (const file of files) {
            console.log(`Reading file: ${file.name}`);
            await readExcelFileFromDrive(file.id, scryfallData);
        }
        console.log("All files processed successfully.");
    } catch (error) {
        console.error("Error syncing files from Drive:", error);
    }
}

// Schedule the script to run every 12 hours
setInterval(syncFilesFromDrive, 12 * 60 * 60 * 1000); // 12 hours in milliseconds

// Run the sync immediately
syncFilesFromDrive();
//getDatabaseCards();

//readExcelFile('Core 2019.xlsx');
//readExcelFile('Core 2020.xlsx');
//readExcelFile('Core 2021.xlsx');
//readExcelFile('4th.xlsx');
//readExcelFile('Dragons of Tarkir.xlsx');
//readExcelFile('Eldritch Moon.xlsx');
//readExcelFile('Eternal Masters.xlsx');
//searchDatabase('of', '', '', '', '', '');

// function searchDatabase(name, rarity, color, type, set, page) {
//     const firestore = getFirestore();
//     name = name.toLowerCase();
//     const capitalized = name.charAt(0).toUpperCase() + name.slice(1);

//     const namePart = name === '' ? '' : or(and(where('name', '>=', capitalized), where('name', '<=', capitalized + '\uf8ff')), where('nameArray', 'array-contains-any', name.split(' ')));
//     const rarityPart = rarity === '' ? '' : where('rarity', '==', rarity);
//     const colorPart = color === '' ? '' : where('color', '==', color);
//     const typePart = type === '' ? '' : where('type', '==', type);
//     const setPart = set === '' ? '' : where('set', '==', set);
//     const pagePart = page === '' ? '' : startAfter(lastDoc);

//     const queryParts = [namePart, rarityPart, colorPart, typePart, setPart, pagePart].filter(part => part !== '');

//     var myQuery = query(collection(firestore, 'MagicCards'), and(...queryParts), limit(10));

//     getDocs(myQuery).then(snapshot => {
//         snapshot.forEach(doc => {
//             console.log(doc.data());
//             lastDoc = doc;
//         });
//         console.log("Search complete.");
//     });
// }

