pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.CollisionMeshComponent
     * @constructor Create a new CollisionMeshComponent
     * @class A box-shaped collision volume. use this in conjunction with a RigidBodyComponent to make a Box that can be simulated using the physics engine.
     * @param {pc.fw.CollisionMeshComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @property {String} asset The GUID of the asset for the model
     * @property {pc.scene.Model} model The model that is added to the scene graph.
     * @extends pc.fw.Component
     */


     // Events Documentation   
    /**
     * @private
     * @event
     * @name pc.fw.CollisionMeshComponent#contact
     * @description The {@link pc.fw.EVENT_CONTACT} event is fired when a contact occurs between this collider and another one
     * @param {pc.fw.ContactResult} result Details of the contact between the two bodies
    */

    /**
     * @private
     * @event
     * @name pc.fw.CollisionMeshComponent#collisionstart
     * @description The {@link pc.fw.EVENT_COLLISIONSTART} event is fired when another collider enters this collider
     * @param {pc.fw.ContactResult} result Details of the contact between the two bodies
    */

    /**
     * @private
     * @event
     * @name pc.fw.CollisionMeshComponent#collisionend
     * @description The {@link pc.fw.EVENT_COLLISIONEND} event is fired when a collider has stopped touching this collider
     * @param {pc.fw.Entity} other The entity that stopped touching this collider
    */
    
    var CollisionMeshComponent = function CollisionMeshComponent (system, entity) {
        this.on("set_asset", this.onSetAsset, this);
        this.on("set_model", this.onSetModel, this);
        if (!entity.rigidbody) {
            entity.on('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
        }
    };
    CollisionMeshComponent = pc.inherits(CollisionMeshComponent, pc.fw.Component);
    
    pc.extend(CollisionMeshComponent.prototype, {

        loadModelAsset: function(guid) {
            var options = {
                parent: this.entity.getRequest()
            };

            var asset = this.system.context.assets.getAsset(guid);
            if (!asset) {
                logERROR(pc.string.format('Trying to load model before asset {0} is loaded.', guid));
                return;
            }

            this.system.context.assets.load(asset, [], options).then(function (resources) {
                var model = resources[0];

                this.model = model;

                this.data.shape = this.createShape();

                if (this.entity.rigidbody) {
                    this.entity.rigidbody.createBody();
                } else {
                    if (!this.entity.trigger) {
                        this.entity.trigger = new pc.fw.Trigger(this.system.context, this, this.data);
                    }
                    this.entity.trigger.initialize(this.data);
                }

            }.bind(this));
        },

        onSetAsset: function (name, oldValue, newValue) {
            if (newValue) {
                this.loadModelAsset(newValue);
            } else {
                this.model = null;
            }
        },

        onSetModel: function (name, oldValue, newValue) {
        },

        createShape: function () {
            if (typeof(Ammo) !== 'undefined') {
                var model = this.model;

                var shape = new Ammo.btCompoundShape();

                var i, j;
                for (i = 0; i < model.meshInstances.length; i++) {
                    var meshInstance = model.meshInstances[i];
                    var mesh = meshInstance.mesh;
                    var ib = mesh.indexBuffer[pc.scene.RENDERSTYLE_SOLID];
                    var vb = mesh.vertexBuffer;

                    var format = vb.getFormat();
                    var stride = format.size / 4;
                    var positions;
                    for (j = 0; j < format.elements.length; j++) {
                        var element = format.elements[j];
                        if (element.name === pc.gfx.SEMANTIC_POSITION) {
                            positions = new Float32Array(vb.lock(), element.offset);
                        }
                    }

                    var indices = new Uint16Array(ib.lock());
                    var numTriangles = mesh.primitive[0].count / 3;

                    var v1 = new Ammo.btVector3();
                    var v2 = new Ammo.btVector3();
                    var v3 = new Ammo.btVector3();
                    var i1, i2, i3;

                    var base = mesh.primitive[0].base;
                    var triMesh = new Ammo.btTriangleMesh();
                    for (j = 0; j < numTriangles; j++) {
                        i1 = indices[base+j*3] * stride;
                        i2 = indices[base+j*3+1] * stride;
                        i3 = indices[base+j*3+2] * stride;
                        v1.setValue(positions[i1], positions[i1 + 1], positions[i1 + 2]);
                        v2.setValue(positions[i2], positions[i2 + 1], positions[i2 + 2]);
                        v3.setValue(positions[i3], positions[i3 + 1], positions[i3 + 2]);
                        triMesh.addTriangle(v1, v2, v3, true);
                    }

                    var useQuantizedAabbCompression = true;
                    var triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, useQuantizedAabbCompression);

                    var wtm = meshInstance.node.getWorldTransform();
                    var scl = pc.math.mat4.getScale(wtm);
                    triMeshShape.setLocalScaling(new Ammo.btVector3(scl[0], scl[1], scl[2]));

                    var position = meshInstance.node.getPosition();
                    var rotation = meshInstance.node.getRotation();

                    var transform = new Ammo.btTransform();
                    transform.setIdentity();
                    transform.getOrigin().setValue(position[0], position[1], position[2]);

                    var ammoQuat = new Ammo.btQuaternion();
                    ammoQuat.setValue(rotation[0], rotation[1], rotation[2], rotation[3]);
                    transform.setRotation(ammoQuat);

                    shape.addChildShape(transform, triMeshShape);
                }

                return shape;
            } else {
                return undefined;
            }
        },

        /**
         * Handle an update over livelink from the tools updating the Entities transform
         */
        onLiveLinkUpdateTransform: function (position, rotation, scale) {
            if (this.entity.trigger) {
                this.entity.trigger.syncEntityToBody();
            } else {
                 this.entity.off('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
            }
        }
    });

    return {
        CollisionMeshComponent: CollisionMeshComponent
    };
}());