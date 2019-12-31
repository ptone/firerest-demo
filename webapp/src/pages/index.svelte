<script lang="ts">
  import { goto } from '@sveltech/routify';
  import { url } from '@sveltech/routify';


  let x = $url('/test');
  console.log(x);
  // $goto('/test');  
</script>


<h1>Home {x} </h1>