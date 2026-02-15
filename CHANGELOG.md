# Changelog

## [0.2.2](https://github.com/arenahito/piggychick/compare/piggychick-v0.2.1...piggychick-v0.2.2) (2026-02-15)


### Bug Fixes

* **live-reload:** switch to single global SSE stream ([#3](https://github.com/arenahito/piggychick/issues/3)) ([150c09b](https://github.com/arenahito/piggychick/commit/150c09b534f84cbb847367af2d2e9a6ef5d6c8cc))

## [0.2.1](https://github.com/arenahito/piggychick/compare/piggychick-v0.2.0...piggychick-v0.2.1) (2026-02-11)


### Bug Fixes

* **ci:** run tests on pull requests only and harden static path validation ([c26f3bd](https://github.com/arenahito/piggychick/commit/c26f3bdeeb3e21f61448b5bd6a73c56d761a3ab2))

## [0.2.0](https://github.com/arenahito/piggychick/compare/piggychick-v0.1.0...piggychick-v0.2.0) (2026-02-11)


### Features

* add ci and improve sklills ([fac3423](https://github.com/arenahito/piggychick/commit/fac34232c1d17cbf466690b81e156e61d7e3bf92))
* **api:** add prd list metadata ([648d611](https://github.com/arenahito/piggychick/commit/648d611fc98d09e966d51fad942e886304972cc7))
* **api:** add prd sort parameter ([44a3764](https://github.com/arenahito/piggychick/commit/44a37646cdaf3bde228bf18d794f0a7ba5fe8617))
* **api:** include prdPath in plan payload ([f0b8b25](https://github.com/arenahito/piggychick/commit/f0b8b25f588eea23525ef8c4c915f62042f81a0f))
* auto refresh ([adca228](https://github.com/arenahito/piggychick/commit/adca228210f7165b51ad3d18816a74378dd24654))
* **cli:** add config-based commands ([1b3a77f](https://github.com/arenahito/piggychick/commit/1b3a77f7d27fb837d7fc4be06ad063b6410fb759))
* **cli:** add pgch launcher ([a8e3928](https://github.com/arenahito/piggychick/commit/a8e3928ffb8541656578af244bc3a02455850716))
* **client:** add config editor highlighting ([7a10fd1](https://github.com/arenahito/piggychick/commit/7a10fd1b9771ee43567393974bc25a7694011119))
* **client:** add config editor view ([e803414](https://github.com/arenahito/piggychick/commit/e803414f7789e361f6929b86e4a9c3b21f81f1d7))
* **client:** add markdown section navigation ([dc2ac91](https://github.com/arenahito/piggychick/commit/dc2ac919e365b1f79a8339e77bfe989b61f21466))
* **client:** add prd path header ([b34fa24](https://github.com/arenahito/piggychick/commit/b34fa248ddc14bd1c1f7611ac0c5539fbe186e2a))
* **client:** handle prd list meta ([a6ef43b](https://github.com/arenahito/piggychick/commit/a6ef43baf71cbf3c5a39cd4b029c1ad8c84be445))
* **client:** render PRD markdown sections ([121fbd4](https://github.com/arenahito/piggychick/commit/121fbd4a1f87364a08cd30eac82b18db87a3597d))
* **client:** request prd sort desc ([20deb70](https://github.com/arenahito/piggychick/commit/20deb70f4255fe0166050746f4498ddec2edf11c))
* **client:** support multi-root state ([2b29c21](https://github.com/arenahito/piggychick/commit/2b29c2100fefbaf580bf958ffe82a6c3a05fb57c))
* **client:** support status-based task states in plan graph ([4347b01](https://github.com/arenahito/piggychick/commit/4347b01be506672db1c67faee1ef115af5e3964c))
* **client:** switch sidebar to PRD-only selection ([7d55975](https://github.com/arenahito/piggychick/commit/7d5597549e145428a501161b63ff385cdfe9c9e5))
* **config:** add config read/write api ([a13f966](https://github.com/arenahito/piggychick/commit/a13f96623cf3c287e92b9cc1554c6aaeea28522a))
* **config:** add JSONC config utilities ([b8ad86d](https://github.com/arenahito/piggychick/commit/b8ad86d4fecb929ee9ce73e04d2821b12dd89c9d))
* **plan-view:** add zoom funciton to dependency tree ([f51ee2e](https://github.com/arenahito/piggychick/commit/f51ee2eeda895eecab9cb38d15215a4e18dad5af))
* **server:** add multi-root API ([01a183e](https://github.com/arenahito/piggychick/commit/01a183e6d44163e1935818a2d4e9fba708177270))
* **sidebar:** add collapsible root header state ([9723ca8](https://github.com/arenahito/piggychick/commit/9723ca8177075894dd74be36b591620e0d1af041))
* **sidebar:** add prd filters and controls ([1436e84](https://github.com/arenahito/piggychick/commit/1436e841be233a9cedfa9353fc2d6c9e792f9de1))
* **sidebar:** add root path copy button ([f8cb081](https://github.com/arenahito/piggychick/commit/f8cb08158bc85cb809d6b75fbf081f1f60a32bf1))
* **sidebar:** emphasize root header styles ([72f7d9a](https://github.com/arenahito/piggychick/commit/72f7d9aed89b9ac30a08ca2ea783f7a26b46138f))
* **skills:** improve skills ([aaf05a9](https://github.com/arenahito/piggychick/commit/aaf05a9b635a975fac71e95efed1c0d138cf4233))
* **startup:** create config when missing ([fd9e0d6](https://github.com/arenahito/piggychick/commit/fd9e0d66971b5a75b38e266208d562af112408a5))
* **tasks:** add worktree PRD listing ([bdd1886](https://github.com/arenahito/piggychick/commit/bdd18868ee471ae2f1206a0660755c099fb3d4bb))
* **tasks:** compute prd progress in list ([aef2d6d](https://github.com/arenahito/piggychick/commit/aef2d6db215406250b03c1f0d07799fae3e9fd61))
* **tasks:** improve PRD title ([356ed50](https://github.com/arenahito/piggychick/commit/356ed506e5ab626abcfb097e95ea4a8865a4ec81))
* **tasks:** prioritize status for PRD progress calculation ([b487a6e](https://github.com/arenahito/piggychick/commit/b487a6e458508c367802592558ebc491fe827836))
* **tasks:** resolve worktree PRD ids ([33e3fb8](https://github.com/arenahito/piggychick/commit/33e3fb8341f51a4d2ab30e59c88e5fb45c367faa))
* **ui:** add multi-root sidebar controls ([6f3ae71](https://github.com/arenahito/piggychick/commit/6f3ae719fd176064468fbed12a5eeb16c4fc0e5d))
* **ui:** add sidebar root header ([4d67b73](https://github.com/arenahito/piggychick/commit/4d67b73af4d39ddc24c94cd7183efa31d8e43df2))
* **ui:** label worktree in mobile selector ([9d2c825](https://github.com/arenahito/piggychick/commit/9d2c825e393bf5e9cbf7dd90687ad7d2c9677b26))
* **ui:** show prd progress in sidebar ([ffec717](https://github.com/arenahito/piggychick/commit/ffec717b4751511a79f673c1572b33c97abcff53))
* **ui:** show worktree labels ([8e16c40](https://github.com/arenahito/piggychick/commit/8e16c400220675b4ae32b6a5a181e35435668537))
* **ui:** style prd path header ([95f9f2e](https://github.com/arenahito/piggychick/commit/95f9f2e17d334a03171600cb7f5666f4d97831ea))


### Bug Fixes

* **client:** adjust hash parsing ([581eda9](https://github.com/arenahito/piggychick/commit/581eda9ca747c25437cc1391693f5ecd22db20bf))
* **server:** decode route segments ([786147f](https://github.com/arenahito/piggychick/commit/786147f53e29b8ab9f9b2979c6080e9ce7f88182))
* **sidebar:** allow root collapse ([99e9901](https://github.com/arenahito/piggychick/commit/99e990155841662f6b543abbd080feda2ba5aa72))
* **sidebar:** improve list visibility and a11y ([17cd729](https://github.com/arenahito/piggychick/commit/17cd72952cdec6daac5f25808d1a3c3d2008c60b))
* **startup:** align tasks root defaults ([5363ad8](https://github.com/arenahito/piggychick/commit/5363ad854b0b7dacb90afd843bc86ca90fff11cb))
* **ui:** adjust sidebar width and status size ([b56efb8](https://github.com/arenahito/piggychick/commit/b56efb81e9000ab7c2cde4e80505fd84d6c77b6e))
* **ui:** clamp PRD title to two lines ([ecb5063](https://github.com/arenahito/piggychick/commit/ecb50637875da7c60160e60dc0aba76bf1825826))
* **ui:** clamp sidebar prd titles to two lines ([ec6d380](https://github.com/arenahito/piggychick/commit/ec6d380b315ba80314b536fd0d326acf133297da))
* **ui:** improve toolbar accessibility ([2a763cd](https://github.com/arenahito/piggychick/commit/2a763cdca2b673eb203c80e57a5fcc9fc57098da))
* **ui:** match plan copy button size ([6529c86](https://github.com/arenahito/piggychick/commit/6529c866699f993202dbd818558fbd0373d23c7e))
