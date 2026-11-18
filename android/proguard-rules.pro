# Consumer rules: they are applied to every app that uses this module.
#
# The Mapbox Java models that the Navigation SDK depends on reference the AutoValue
# annotations, which are not on the runtime classpath. In our Expo 54 test app R8 stopped
# a minified release build with "Missing class com.google.auto.value.AutoValue" until
# these two warnings were suppressed.
-dontwarn com.google.auto.value.AutoValue
-dontwarn com.google.auto.value.AutoValue$Builder
