<script lang="ts">
  import { onMount, onDestroy } from "svelte";


  import TopAppBar, {Row, Section, Title} from '@smui/top-app-bar';
  import IconButton from '@smui/icon-button';
  import Menu, {SelectionGroup, SelectionGroupIcon} from '@smui/menu';
  import List, {Item, Separator, Text, PrimaryText, SecondaryText, Graphic} from '@smui/list';
  import Drawer, {AppContent, Content, Header, Subtitle, Scrim} from '@smui/drawer';

  import { writable } from "svelte/store";
  import { myStore } from "./store";

  import Counter from "./Counter.svelte";
  import Login from "./Login.svelte";
  import Profile from "./Profile.svelte"
  import { user } from "./authstore"

  const count = writable(100);
  const unsubscribe = count.subscribe(value => console.log("count", value));


  export let name: string;
  let menu;
  let myDrawer;
  let myDrawerOpen = false;

  let active = 'Gray Kittens';





  onMount(() => {
    console.log("App mounted");
  });

  onDestroy(() => {
    unsubscribe();
  });
</script>




<div class="">
<TopAppBar variant="fixed">
  <Row>
    <Section>
      <IconButton class="material-icons" on:click={() => myDrawerOpen = !myDrawerOpen}>menu</IconButton>
      <Title>{name} API Demo</Title>
    </Section>
    <Section align="end" toolbar>
      <IconButton class="material-icons" aria-label="Download">file_download</IconButton>
      <IconButton class="material-icons" aria-label="Print this page">print</IconButton>
      <div>
      <IconButton class="material-icons menu-toggle-button" aria-label="User" on:click={() => menu.setOpen(true)}>account_circle</IconButton>
      <Menu bind:this={menu} anchorCorner="BOTTOM_LEFT">
        <List>
          <!-- <Item><Text>Login</Text></Item> -->
          <Login />
        </List>
      </Menu>
      </div>
    </Section>
  </Row>
</TopAppBar>
</div>

<Drawer class="app-drawer-layout" variant="dismissible" bind:this={myDrawer} bind:open={myDrawerOpen}>
  <Header>
    <Title>Super Drawer</Title>
    <Subtitle>It's the best drawer.</Subtitle>
  </Header>
  <Content>
    <List>
      <Item href="javascript:void(0)" on:click={() => setActive('Gray Kittens')} activated={active === 'Gray Kittens'}>
        <Text>Gray Kittens</Text>
      </Item>
      <Item href="javascript:void(0)" on:click={() => setActive('A Space Rocket')} activated={active === 'A Space Rocket'}>
        <Text>A Space Rocket</Text>
      </Item>
      <Item href="javascript:void(0)" on:click={() => setActive('100 Pounds of Gravel')} activated={active === '100 Pounds of Gravel'}>
        <Text>100 Pounds of Gravel</Text>
      </Item>
      <Item href="javascript:void(0)" on:click={() => setActive('All of the Shrimp')} activated={active === 'All of the Shrimp'}>
        <Text>All of the Shrimp</Text>
      </Item>
      <Item href="javascript:void(0)" on:click={() => setActive('A Planet with a Mall')} activated={active === 'A Planet with a Mall'}>
        <Text>A Planet with a Mall</Text>
      </Item>
    </List>
  </Content>
</Drawer>
<main class="main-content mdc-drawer-app-content">

<div class="mdc-top-app-bar--fixed-adjust ">
<p>
  <Profile {...$user} />
  <Counter />
  <Counter value={1}>Counter 1ab</Counter>
  <Counter bind:value={$count} step={3}>Counter 2</Counter>
  <Counter bind:value={$myStore} step={5}>Counter 3</Counter>
</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
<p>blah</p>
</div>
</main>