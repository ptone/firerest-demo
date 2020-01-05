<script lang="ts">
  import DataTable, {Head, Body, Row, Cell} from '@smui/data-table';
  import Fab, {Icon} from '@smui/fab';
  import IconButton from '@smui/icon-button';


  import { onMount } from 'svelte';
  import { testFetch } from '../../api'

  function doSomething() {
  }

  let data = [];


	onMount(() => {
    testFetch().then((d) => data = d);
	});

  function deleteItem(id) {
    alert(id);
  }
</script>

<style>
:global(#list-view) {
  width: 100%;
}

:global(app-fab--absolute) {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
}

.lower-right {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
}

@media(min-width: 1024px) {
    .app-fab--absolute {
    bottom: 1.5rem;
    right: 1.5rem;
  }
}

</style>

<!-- {#await testFetch() }
<p>getting data...</p>
{:then data} -->

<DataTable id="list-view" table$aria-label="Cars">
  <Head>
    <Row>
      <Cell>Year</Cell>
      <Cell>Make</Cell>
      <Cell>Model</Cell>
    </Row>
  </Head>
  <Body>
  {#each data as {id, year, make, model }, i}
    <Row on:click={doSomething} >
      <Cell>{ year }</Cell>
      <Cell>{ make }</Cell>
      <Cell>{ model }</Cell>
      <Cell>
        <IconButton class="material-icons" on:click={doSomething}>edit</IconButton>
        <IconButton class="material-icons" on:click={() => deleteItem(id)}>delete</IconButton>
      </Cell>
    </Row>
  {/each}
  </Body>
</DataTable>
<div class="lower-right">
  <Fab class="app-fab--absolute" on:click={doSomething}><Icon class="material-icons">add</Icon></Fab>
</div>

<!-- {:catch error}
<p>Something went wrong: {error.message}</p>
{/await} -->