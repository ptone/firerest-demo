import { getToken } from './firebase';

async function testFetch() {
  let t = await getToken();
  console.log(t);
  var myHeaders = new Headers({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + t
  });
  
  let response = await fetch('https://api-demo-gateway-avzcrpvnta-uc.a.run.app/api/v1/cars?limit=25', {
    headers: myHeaders
  });
  console.log(response);
  let myJson = await response.json();
  console.log(myJson);
  // return JSON.stringify(myJson);
  return myJson
}

export { testFetch }