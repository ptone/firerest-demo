<script lang="ts">
  import { fade } from 'svelte/transition';
  import DataTable, {Head, Body, Row, Cell} from '@smui/data-table';
  import CustomRow from './_components/CustomRow.svelte';
  import Fab, {Icon} from '@smui/fab';
  import IconButton from '@smui/icon-button';
  import Dialog, {Title, Content, Actions, InitialFocus} from '@smui/dialog';
  import Button, {Label} from '@smui/button';
  import LinearProgress from '@smui/linear-progress';
  import Spinner from '../_components/Spinner.svelte';

  import { onMount, tick } from 'svelte';

  import { listItems, updateItem, deleteItem } from '../../api'

  import EditForm from './_components/EditForm.svelte'

  import  uuidv4  from 'uuid/v4';


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
  let createOrUpdate = "Update";
  let editDialog;
  let deletingItem;
  let savingItem;

  function editItem(item) {
    if (!item.id) {
      item.id = uuidv4();
      createOrUpdate = "Create";
      data.unshift(item);
    } else {
      createOrUpdate = "Update";
    }
    console.log(item);
    editingItem = item;
    editDialog.open();
  }

	onMount(() => {
    refresh();
	});

  function deleteRow(id) {
    deletingItem = id;
    deleteItem(id).then((r) => {
      data = data.filter(i => i.id !== id);
    });
  }
  function createItem() {

    editItem({
        make: "",
        model: "",
        year: 1980,
        body_styles: []
      });
  }

  function saveHandler() {
    savingItem = editingItem.id;
    console.log("dialog save");
    console.log(editingItem);
          let foundIndex = data.findIndex(x => x.id == editingItem.id);
      data[foundIndex] = editingItem
    updateItem(editingItem).then((item) => {
      savingItem = "";
    });
  }

   function refresh() {
    deletingItem = "";
    data = [];
    // tick is here to try to force a redraw with empty array
    tick().then(() => {
      listItems().then((d) => {
        console.log(d.length);
        data = data.concat(d);
      });
    });
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
  {#each data as item, i (item.id)}
    <CustomRow id={item.id} deleting={item.id == deletingItem} saving={item.id == savingItem}>

      <Cell>{ item.year }</Cell>
      <Cell>{ item.make }</Cell>
      <Cell>{ item.model }</Cell>
      <Cell>
      {#if item.id == savingItem}
        <Spinner size=20 />
      {:else}
        <IconButton class="material-icons" on:click={() => editItem(item)}>edit</IconButton>
      {/if}
        <IconButton class="material-icons" on:click={() => deleteRow(item.id)}>delete</IconButton>
      </Cell>
    </CustomRow>

  {/each}
  </Body>
</DataTable>
<div class="lower-right">
  <Fab class="app-fab--absolute" on:click={createItem}><Icon class="material-icons">add</Icon></Fab>
</div>
<div class="upper-right">
  <Fab on:click={refresh}><Icon class="material-icons">refresh</Icon></Fab>
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
      <Label>{createOrUpdate}</Label>
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

.upper-right {
  position: fixed;
  top: 10rem;
  right: 1rem;
}


:global(tr[deleting="true"].mdc-data-table__row)  {
  background-color: #f7d7d5 !important;
}

:global(tr[saving="true"].mdc-data-table__row)  {
  background-color: darkgray !important;
}

</style>