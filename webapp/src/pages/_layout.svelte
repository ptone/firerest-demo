<script lang="ts">
  import Menu, {SelectionGroup, SelectionGroupIcon} from '@smui/menu';
  import List, {Item, Separator, Text, PrimaryText, SecondaryText, Graphic} from '@smui/list';
  import AppHeader from "./_components/AppHeader.svelte";
  import AppNav from "./_components/AppNav.svelte";
  import Profile from "./_components/Profile.svelte";
  import { navOpen } from "../navstate-store";


  import { user } from "../authstore"
  // import { url } from '@sveltech/routify'

  export let name: string;

  // let testurl = $url("/test");
  let testurl = "foo";
  // console.log(url);
  // console.log(url.subscribe);
  // console.log(url.subscribe("foo"));


</script>

<style>
.mdc-drawer-app-content {
  flex: auto;
  overflow: auto;
  position: relative;
}

.main-content {
  overflow: auto;
  height: 100%;
  padding-left: 10px;
}
</style>


<AppHeader name={name} />
<AppNav />
<div class="mdc-drawer-app-content mdc-top-app-bar--fixed-adjust">
  <main class="main-content ">
  {#if $user}
  <p>user: {$user.uid} </p>
{:else}
  <p>not logged in</p>
{/if}
<p>{ $navOpen }</p>
  <slot />
</main>
</div>