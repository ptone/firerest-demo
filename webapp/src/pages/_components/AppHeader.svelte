<script lang="ts">
  import TopAppBar, {Row, Section, Title} from '@smui/top-app-bar';
  import IconButton from '@smui/icon-button';
  import List from '@smui/list';
  import Login from "./Login.svelte";
  import Menu, {SelectionGroup, SelectionGroupIcon} from '@smui/menu';
  import { navOpen } from "../../navstate-store";
  import { user } from '../../authstore';
  let menu;
  export let name = "my-site";
</script>


<style>

:global(.mdc-top-app-bar) {
  z-index: 7;
}

img {
  border-radius: 50%;
  padding-left: 17px;
}

</style>

<TopAppBar variant="standard">
  <Row>
    <Section>
      <IconButton class="material-icons" on:click={() => navOpen.set(!$navOpen) }>menu</IconButton>
      <Title>{name} API Demo</Title>
    </Section>
    <Section align="end" toolbar>
      <IconButton class="material-icons" aria-label="Download">file_download</IconButton>
      <IconButton class="material-icons" aria-label="Print this page">print</IconButton>
      <div>
      {#if $user}
        <img src={ $user.photoURL } on:click={() => menu.setOpen(true)} width="30" alt="user avatar">
      {:else}
        <IconButton class="material-icons menu-toggle-button" aria-label="User" on:click={() => menu.setOpen(true)}>account_circle</IconButton>
      {/if}
      <Menu bind:this={menu} anchorCorner="BOTTOM_LEFT">
        <List>
          <Login />
        </List>
      </Menu>
      </div>
    </Section>
  </Row>
</TopAppBar>