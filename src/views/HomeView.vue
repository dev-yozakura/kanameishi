<template>
  <div class="outer">
    <MainMapComponent></MainMapComponent>
    <GqYuzhnoTestPanel></GqYuzhnoTestPanel>
  </div>
</template>

<script setup>
import MainMapComponent from '@/components/MainMapComponent.vue';
import GqYuzhnoTestPanel from '@/components/GqYuzhnoTestPanel.vue';
</script>

<style lang="scss" scoped>
.outer {
  width: 100%;
  height: 100%;
}
</style>