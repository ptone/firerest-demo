<script>
    export let displayName;
    export let photoURL;
    export let uid;
</script>

<style>
img {
  border-radius: 50%;
}
</style>

<h3>Hi { displayName }!</h3>

<img src={ photoURL } width="25" alt="user avatar">
<p>Your userID is { uid }</p>
