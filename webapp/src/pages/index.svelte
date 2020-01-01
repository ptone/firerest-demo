<script lang="ts">
  import { goto } from '@sveltech/routify';
  import { url } from '@sveltech/routify';
  import { testFetch } from '../api'

  let x = $url('/test');
  console.log(x);

  async function tryFetch() {
    let t = await testFetch();
    console.log(t);
  }
</script>


<h1>Home {x} </h1>

<button on:click={ tryFetch }>boo</button>

    {#await testFetch() }
    <p>getting token...</p>
    {:then token}
    <p>origin: { token }</p>
    {:catch error}
    <p>Something went wrong: {error.message}</p>
    {/await}