<script>
  export let displayName;
  export let photoURL;
  export let uid;


  // import { url } from '@sveltech/routify';
  // let x = $url('/test');
  // console.log(x)

</script>

<style>
img {
  border-radius: 50%;
}
</style>

<h3>Hi { displayName }!</h3>

<img src={ photoURL } width="25" alt="user avatar">
<p>Your userID is { uid }</p>
