<script lang="ts">
  import { goto } from '@sveltech/routify';
  import { url } from '@sveltech/routify';
  import { listItems } from '../api';
  import Spinner from './_components/Spinner.svelte';

  let x = $url('/test');
  console.log(x);

  async function tryFetch() {
    let t = await testFetch();
    console.log(t);
  }
</script>


<h1>Home {x} </h1>

<Spinner size=20 />

<button on:click={ listItems }>test fetch</button>

    {#await listItems() }
    <p>getting data...</p>
    {:then token}
    <p>data: { token }</p>
    {:catch error}
    <p>Something went wrong: {error.message}</p>
    {/await}