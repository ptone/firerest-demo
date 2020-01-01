import { getToken } from './firebase';

async function testFetch() {
  let t = await getToken();
  // console.log(t);
  var myHeaders = new Headers({
    'Content-Type': 'application/json',
    'Authorization': 'bearer ' + t
  });
  
  let response = await fetch('https://ohttpbin-avzcrpvnta-uc.a.run.app/get', {
    headers: myHeaders
  });
  let myJson = await response.json();
  console.log(myJson);
  return JSON.stringify(myJson);
}

export { testFetch }