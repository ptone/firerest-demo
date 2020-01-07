<script lang="ts">
  import Counter from "../Counter.svelte";
  import Profile from "./_components/Profile.svelte"
  import { user } from "../authstore"
  import { writable } from 'svelte/store';

  const count = writable(100);
  const unsubscribe = count.subscribe(value => console.log("count", value));
  import { myStore } from "../store";

</script>
<p>
  <Profile {...$user} />
  <Counter />
  <Counter value={1}>Counter 1ab</Counter>
  <Counter bind:value={$count} step={3}>Counter 2</Counter>
  <Counter bind:value={$myStore} step={5}>Counter 3</Counter>
</p>
<p>so many blah to debug scrolling</p>
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