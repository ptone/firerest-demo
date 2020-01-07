<script lang="ts">
  import DataTable, {Head, Body, Row, Cell} from '@smui/data-table';
  import Fab, {Icon} from '@smui/fab';
  import IconButton from '@smui/icon-button';
  import Dialog, {Title, Content, Actions, InitialFocus} from '@smui/dialog';
  import Button, {Label} from '@smui/button';
  import LinearProgress from '@smui/linear-progress';

  import { onMount } from 'svelte';
  import { testFetch } from '../../api'

  import EditForm from './_components/EditForm.svelte'

  function doSomething() {
    console.log("something");
  }

  function closeHandler(e) {
    console.log("dialog closed");
    console.log(e.detail.action);
    if (e.detail.action == "update") {
      saveHandler();
    }

  }

  let data = [];
  let editingItem = {
    make: "",
    model: "",
    year: 1980,
    body_styles: []
  };

  let editDialog;

  function editItem(id) {
    console.log(id);
    editingItem = id;
    editDialog.open();
  }

	onMount(() => {
    testFetch().then((d) => data = d);
	});

  function deleteItem(id) {
    alert(id);
  }

  function saveHandler() {
    console.log("dialog save");
    console.log(editingItem);
  }
</script>

<h4 class="mdc-typography--headline4">Car Models</h4>

{#if data.length}
<DataTable id="list-view" table$aria-label="Cars">
  <Head>
    <Row>
      <Cell>Year</Cell>
      <Cell>Make</Cell>
      <Cell>Model</Cell>
    </Row>
  </Head>
  <Body>
  {#each data as item, i}
    <Row>
    <!-- <Row on:click={doSomething} > -->
      <Cell>{ item.year }</Cell>
      <Cell>{ item.make }</Cell>
      <Cell>{ item.model }</Cell>
      <Cell>
        <IconButton class="material-icons" on:click={() => editItem(item)}>edit</IconButton>
        <IconButton class="material-icons" on:click={() => deleteItem(item.id)}>delete</IconButton>
      </Cell>
    </Row>
  {/each}
  </Body>
</DataTable>
<div class="lower-right">
  <Fab class="app-fab--absolute" on:click={doSomething}><Icon class="material-icons">add</Icon></Fab>
</div>
{:else}
  <LinearProgress indeterminate />
{/if}

<Dialog
  bind:this={editDialog}
  aria-labelledby="dialog-title"
  aria-describedby="dialog-content"
  on:MDCDialog:closed={closeHandler}
  on:MDCDialog:accept={saveHandler}
>
  <Title id="dialog-title">Edit Item {editingItem.id}</Title>
  <Content id="dialog-content">
    <EditForm bind:item={editingItem} ></EditForm>
  </Content>
  <Actions>
    <Button action="cancel">
      <Label>Cancel</Label>
    </Button>
    <Button action="update" default use={[InitialFocus]}>
      <Label>Update</Label>
    </Button>
  </Actions>
</Dialog>


<style>
:global(#list-view) {
  width: 100%;
}

.lower-right {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
}
</style>