<script lang="ts">
  import { Router, Link, Route } from "svelte-routing";


  import Menu, {SelectionGroup, SelectionGroupIcon} from '@smui/menu';
  import List, {Item, Separator, Text, PrimaryText, SecondaryText, Graphic} from '@smui/list';
  import Drawer, {AppContent, Content, Header, Subtitle, Scrim, Title } from '@smui/drawer';
 
  import { navOpen } from "./navstate-store";
  
  let myDrawer;
  let myDrawerOpen = false;

  let active = 'Gray Kittens';
  
 </script>


<Drawer class="app-drawer-layout" variant="dismissible" bind:this={myDrawer} bind:open={$navOpen}>
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