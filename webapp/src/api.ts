import { getToken } from './firebase';

const endpointURL = 'https://api-demo-gateway-avzcrpvnta-uc.a.run.app/api/v1'
async function getAuth() {
  let t = await getToken();
  console.log(t);
  var myHeaders = new Headers({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + t
  });
  return myHeaders;
}


async function listItems() {
  let myHeaders = await getAuth();
  console.log(`${endpointURL}/cars?limit=25`); 
  let response = await fetch(`${endpointURL}/cars?limit=25`, {
    headers: myHeaders
  });
  console.log(response);
  let myJson = await response.json();
  return myJson
}

async function updateItem(item: any) {
  let myHeaders = await getAuth();
  let response = await fetch(`${endpointURL}/cars/${item.id}`, {
    method: 'PUT',
    body: JSON.stringify(item),  
    headers: myHeaders
  });
  let myJson = await response.json();
  return myJson
}

async function deleteItem(id: string) {
  let myHeaders = await getAuth();
  let response = await fetch(`${endpointURL}/cars/${id}`, {
    method: 'delete',
    headers: myHeaders
  });
  let myJson = await response.json();
  return myJson
}

export { listItems, updateItem, deleteItem }