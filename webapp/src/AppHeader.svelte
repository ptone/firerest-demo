<script lang="ts">
  import TopAppBar, {Row, Section, Title} from '@smui/top-app-bar';
  import IconButton from '@smui/icon-button';
  import List from '@smui/list';
  import Login from "./Login.svelte";
  import Menu, {SelectionGroup, SelectionGroupIcon} from '@smui/menu';
  import { navOpen } from "./navstate-store"
  let menu;
  export let name = "my-site";
</script>


<div class="">
<TopAppBar variant="fixed">
  <Row>
    <Section>
      <IconButton class="material-icons" on:click={() => navOpen.set(!$navOpen) }>menu</IconButton>
      <Title>{name} API Demo</Title>
    </Section>
    <Section align="end" toolbar>
      <IconButton class="material-icons" aria-label="Download">file_download</IconButton>
      <IconButton class="material-icons" aria-label="Print this page">print</IconButton>
      <div>
      <IconButton class="material-icons menu-toggle-button" aria-label="User" on:click={() => menu.setOpen(true)}>account_circle</IconButton>
      <Menu bind:this={menu} anchorCorner="BOTTOM_LEFT">
        <List>
          <Login />
        </List>
      </Menu>
      </div>
    </Section>
  </Row>
</TopAppBar>
</div>