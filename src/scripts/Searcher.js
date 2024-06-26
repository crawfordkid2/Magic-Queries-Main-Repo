const apiUrl = 'https://api.scryfall.com'; // Base URL of the Scryfall API
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, where, query, getDocs, collection, or, and, limit, startAfter, orderBy, startAt } from 'firebase/firestore';

// Initialize Firebase
const firebaseApp = initializeApp({
  apiKey: "AIzaSyCAVRElz4RmMuQD3-RQ5Ttd1w_h8MTStAc",
  authDomain: "magicproject-77014.firebaseapp.com",
  projectId: "magicproject-77014",
  storageBucket: "magicproject-77014.appspot.com",
  messagingSenderId: "1023897851903",
  appId: "1:1023897851903:web:bbcd8bdf3e81c0ac82f9ca",
})

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const cardContainer = document.getElementById('cardContainer');
var lastCardOnPage = [];

function fetchMagicCards() {
  // get cards from the FireBase database
  const firestore = getFirestore();
  // get the search info from the url
  const urlParams = new URLSearchParams(window.location.search);
  const capitalized = urlParams.get('name') === null ? "" : urlParams.get('name').charAt(0).toUpperCase() + urlParams.get('name').slice(1);
  const name = urlParams.get('name') === null ? "" : urlParams.get('name');
  const namePart = urlParams.get('name') === null ? "" : or(and(where('name', '>=', capitalized), where('name', '<=', capitalized + '\uf8ff')), where('nameArray', 'array-contains-any', name.split(' ')));
  const rarityPart = urlParams.get('rarity') === null ? "" : where('rarity', '==', urlParams.get('rarity'));
  const colorPart = urlParams.get('color') === null ? "" : where('color', '==', urlParams.get('color'));
  const typePart = urlParams.get('type') === null ? "" : where('type', '==', urlParams.get('type'));
  const setPart = urlParams.get('set') === null ? "" : where('set', '==', urlParams.get('set'));
  var pagePart = urlParams.get('page') === null ? 0 : parseInt(urlParams.get('page'));

  const queryParts = [namePart, rarityPart, colorPart, typePart, setPart].filter(part => part !== "");

  // if query is empty, add a default query, that fetches all cards that start with A
  if (queryParts.length === 0) {
    console.log("No search query found");
    queryParts.push(where('name', '>=', 'A'), where('name', '<=', 'A\uf8ff'));
  }

  var myQuery;
  if (pagePart === 0) {
    myQuery = query(collection(firestore, 'MagicCards'), and(...queryParts), orderBy('name'), limit(10));
  } else {
    console.log("lastCardOnPage[" + (pagePart - 1) + "] =", lastCardOnPage[pagePart - 1].data());
    myQuery = query(collection(firestore, 'MagicCards'), and(...queryParts), orderBy('name'), startAfter(lastCardOnPage[pagePart - 1]), limit(10));
  }

  console.log("My query", myQuery);
  var cardList = [];
  getDocs(myQuery).then(snapshot => {
    // store the last card on the page
    if (snapshot.docs.length === 0) {
      console.log("No cards found");
      // remove cards from session storage and page
      cardContainer.innerHTML = '';
      sessionStorage.removeItem('search');
      console.log("Query parts", ...queryParts);
      return;
    }

    if (lastCardOnPage.length === pagePart) {
      lastCardOnPage.push(snapshot.docs[snapshot.docs.length - 1]);
    } else {
      lastCardOnPage[pagePart] = snapshot.docs[snapshot.docs.length - 1];
    }

    sessionStorage.setItem('lastCardOnPage', JSON.stringify(lastCardOnPage));
    console.log("Last card on page", snapshot.docs[snapshot.docs.length - 1].data());
    // get the cards from the database
    snapshot.forEach(doc => {
      console.log(doc.data());
      cardList.push(doc.data());
      // store doc reference in lastCardOnPage array
    });
    console.log("Done fetching cards from firebase");
    // store the cards in session storage
    sessionStorage.setItem('search', JSON.stringify(cardList));
    displayCards();
  });
}

function displayCards() {
  cardContainer.innerHTML = ''; // Clear previous search results
  // get the cards from session storage
  const cards = JSON.parse(sessionStorage.getItem('search'));
  var cardIndex = 0;
  // create a grid of cards with a column of 3 cards
  cards.forEach(card => {
    // Create an image element for the card
    const imgElement = document.createElement('img');
    const cardNormalPicURL = card.picURL.replace('/png', '/normal').replace('.png', '.jpg');

    // create a grid of cards with a column of 3 cards
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');
    // limit the size of the card container
    cardElement.style.width = '20%';
    cardElement.style.margin = '10px';
    cardElement.style.padding = '10px';
    cardElement.style.display = 'inline-block';

    imgElement.src = cardNormalPicURL;
    imgElement.alt = card.name; // Set alt attribute for accessibility    

    // Add click event listener to open a new window with detailed information
    // Right now this doesn't do anything, but we will implement it later
    cardElement.addEventListener('click', () => {
      const newItemWindow = window.open(`/item-details/${card.id}`, '_blank');
      newItemWindow.focus();
    });

    // Create "Add to Cart" button
    const addToCartButton = document.createElement('button');
    addToCartButton.textContent = 'Add to Cart';
    // add border to the button using tailwind
    addToCartButton.classList.add('border', 'border-blue-500', 'text-blue-500', 'rounded-md', 'px-4', 'py-2', 'm-2', 'hover:bg-blue-100');
    addToCartButton.classList.add('add-to-cart');
    addToCartButton.addEventListener('click', event => {
      event.stopPropagation(); // Prevent the click event from bubbling to the card element
      // prompt the user enter the quantity of the card out of the total quantity
      const quantity = prompt(`Enter the quantity of ${card.name} you would like to add to your cart out of ${card.quantity}`);
      // check if the quantity is valid
      if (quantity && quantity > 0 && quantity <= card.quantity) {
        handleAddToCartClick(card, quantity);
      } else {
        alert('Invalid quantity');
      }
    });

    cardElement.appendChild(imgElement);
    cardElement.appendChild(addToCartButton);
    cardContainer.appendChild(cardElement);

    cardIndex++;
  });

  const url = new URL(window.location.href);
  // add a previous page button if the page is greater than 0
  if (parseInt(url.searchParams.get('page')) > 0) {
    const previousPageButton = document.createElement('button');
    previousPageButton.textContent = 'Previous Page';
    previousPageButton.classList.add('border', 'border-blue-500', 'text-blue-500', 'rounded-md', 'px-4', 'py-2', 'm-2', 'hover:bg-blue-100');
    previousPageButton.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('page', parseInt(url.searchParams.get('page')) - 1);
      window.history.pushState({}, '', url);
      fetchMagicCards();
    });
    cardContainer.appendChild(previousPageButton);
  }

  // if there are 10 cards, add a next page button
  if (cardIndex === 10) {
    const nextPageButton = document.createElement('button');
    nextPageButton.textContent = 'Next Page';
    nextPageButton.classList.add('border', 'border-blue-500', 'text-blue-500', 'rounded-md', 'px-4', 'py-2', 'm-2', 'hover:bg-blue-100');

    nextPageButton.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('page', parseInt(url.searchParams.get('page')) + 1);
      window.history.pushState({}, '', url);
      fetchMagicCards();
    });
    cardContainer.appendChild(nextPageButton);
  }

}

async function handleAddToCartClick(card, quantity) {
  // holds needed card info for the cart
  class cardInfo {
    constructor(name, quantity, picURL, price, quantityInStock, set) {
      this.name = name;
      this.quantity = quantity;
      this.picURL = picURL;
      this.price = price;
      this.quantityInStock = quantityInStock;
      this.set = set;
    }
  }
  const cardToSave = new cardInfo(card.name, quantity, card.picURL, card.price, card.quantity, card.set);

  // append the card to the session storage
  const cart = JSON.parse(sessionStorage.getItem('cart')) || [];
  // check if the card is already in the cart
  const cardIndex = cart.findIndex(c => c.name === cardToSave.name && c.set === cardToSave.set);
  if (cardIndex !== -1) {
    // if the card is already in the cart, add the quantity to the existing quantity
    cart[cardIndex].quantity = parseInt(cart[cardIndex].quantity) + parseInt(cardToSave.quantity);
    // check if the quantity is greater than the total quantity of the card
    if (cart[cardIndex].quantity > card.quantity) {
      cart[cardIndex].quantity = card.quantity;
    }
    sessionStorage.setItem('cart', JSON.stringify(cart));
    console.log('Added to cart:', card.name);
    return;
  }
  cart.push(cardToSave);
  sessionStorage.setItem('cart', JSON.stringify(cart));
  console.log('Added to cart:', card.name);
}

// Add event listener to search button to fetch cards when clicked or when enter is pressed.
searchButton.addEventListener('click', async () => {
  const searchTerm = searchInput.value.trim();
  // add search pramas to the URL and the color blue
  const url = new URL(window.location.href);
  url.searchParams.set('name', searchTerm);

  // reset the last card on page
  lastCardOnPage = [];
  sessionStorage.setItem('lastCardOnPage', JSON.stringify(lastCardOnPage));

  // make the page 0
  url.searchParams.set('page', 0);

  // if search is empty, remove the search pramas from the URL
  if (!searchTerm) {
    url.searchParams.delete('name');
  }

  window.history.pushState({}, '', url);
  if (searchTerm || url.searchParams.get('rarity') || url.searchParams.get('color') || url.searchParams.get('type') || url.searchParams.get('set')) {
    fetchMagicCards();
  }
});

// Add event listener to search input to clear search results if input is empty
/*
searchInput.addEventListener('input', () => {
  // Clear search results if input is empty
  if (!searchInput.value.trim()) {
    cardContainer.innerHTML = '';
  }
});
*/

// Add event listener to search input to allow user to press enter to search
searchInput.addEventListener("keypress", function (event) {
  if (event.key === 'Enter') {
    searchButton.click();
  }
});

// add an event listener to the color checkboxes
const colorCheckboxes = document.getElementsByClassName('color-checkbox');
for (let i = 0; i < colorCheckboxes.length; i++) {
  colorCheckboxes[i].addEventListener('change', function () {
    const url = new URL(window.location.href);
    const checkedColors = Array.from(document.querySelectorAll('.color-checkbox:checked')).map(checkbox => checkbox.value);
    if (checkedColors.length > 0) {
      url.searchParams.set('color', checkedColors.sort().join(''));
    } else {
      url.searchParams.delete('color');
    }
    window.history.pushState({}, '', url);
    //fetchMagicCards();
  });
}

// add an event listener to the rarity field
const raritySelect = document.getElementById('raritySelect');
raritySelect.addEventListener('change', function () {
  const url = new URL(window.location.href);
  const rarity = raritySelect.value;
  if (rarity === 'all') {
    url.searchParams.delete('rarity');
    window.history.pushState({}, '', url);
    return;
  }

  if (rarity) {
    url.searchParams.set('rarity', rarity);
  } else {
    url.searchParams.delete('rarity');
  }
  window.history.pushState({}, '', url);
  //fetchMagicCards();
});

// add an event listener to the type field
const typeSelect = document.getElementById('typeSelect');
typeSelect.addEventListener('change', function () {
  const url = new URL(window.location.href);
  const type = typeSelect.value;
  if (type === 'all') {
    url.searchParams.delete('type');
    window.history.pushState({}, '', url);
    return;
  }

  if (type) {
    url.searchParams.set('type', type);
  } else {
    url.searchParams.delete('type');
  }
  window.history.pushState({}, '', url);
  //fetchMagicCards();
});

// add an event listener to the set field
const setSelect = document.getElementById('setSelect');
setSelect.addEventListener('change', function () {
  const url = new URL(window.location.href);
  const set = setSelect.value;
  if (set === 'all') {
    url.searchParams.delete('set');
    window.history.pushState({}, '', url);
    return;
  }

  if (set) {
    url.searchParams.set('set', set);
  } else {
    url.searchParams.delete('set');
  }
  window.history.pushState({}, '', url);
  //fetchMagicCards();
});

// get set names from scryfall
function getSetNames() {
  fetch(`${apiUrl}/sets`)
    .then(response => response.json())
    .then(data => {
      const setSelect = document.getElementById('setSelect');
      // sort the sets by aphabetical order
      data.data.sort((a, b) => a.name.localeCompare(b.name));
      data.data.forEach(set => {
        const option = document.createElement('option');
        option.value = set.name;
        option.text = set.name;
        setSelect.appendChild(option);
      });
    });
}


// move the card container left so it aligns better with the search box
cardContainer.style.marginLeft = '-20px';

getSetNames();

// Check if there is a search query in the URL
const urlParams = new URLSearchParams(window.location.search);
// set html filter values to the last filter values
const color = urlParams.get('color');
const rarity = urlParams.get('rarity');
const type = urlParams.get('type');
const set = urlParams.get('set');
const colorCheck = document.getElementsByClassName('color-checkbox');
for (let i = 0; i < colorCheckboxes.length; i++) {
  if (color && color.includes(colorCheckboxes[i].value)) {
    colorCheck[i].checked = true;
  }
}
if (rarity) {
  document.getElementById('raritySelect').value = rarity;
}
if (type) {
  document.getElementById('typeSelect').value = type;
}
if (set) {
  document.getElementById('setSelect').value = set;
}
const url = new URL(window.location.href);
url.searchParams.set('page', 0);
window.history.pushState({}, '', url);
fetchMagicCards();
