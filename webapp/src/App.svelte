<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Router, Link, Route } from "svelte-routing";


  import Menu, {SelectionGroup, SelectionGroupIcon} from '@smui/menu';
  import List, {Item, Separator, Text, PrimaryText, SecondaryText, Graphic} from '@smui/list';
  import AppHeader from "./AppHeader.svelte";
  import AppNav from "./AppNav.svelte";

  // import { writable } from "svelte/store";

  import { user } from "./authstore"
  import Test from "./Test.svelte";
  import Home from "./Home.svelte";
  import Profile from "./Profile.svelte";


  export let name: string;

  export let url = "";




  onMount(() => {
    console.log("App mounted");
  });


</script>

<AppHeader name={name} />





<main class="main-content mdc-drawer-app-content">
  <div class="mdc-top-app-bar--fixed-adjust ">

{#if $user}
  <p>user: {$user.uid} </p>
{:else}
  <p>not logged in</p>
{/if}
<p>{ $navOpen }</p>
<Router url="{url}">
  <nav>
    <Link to="/">home</Link>
    <Link to="test">Test</Link>
    <Link to="profile">profile</Link>
  </nav>

  <div>
    <!-- <Route path="test" component="{Test}" /> -->
    <Route path="test"><Test /></Route>
    <Route path="profile">
      <Profile {...$user} />
    </Route>
    <Route path="/"><Home /></Route>
  </div>
</Router>

  </div>
</main>