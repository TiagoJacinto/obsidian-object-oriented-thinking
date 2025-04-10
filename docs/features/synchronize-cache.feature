Feature: Synchronize Cache

Scenario: Successful Synchronization of Created Files
Given the files "File1" and "File2" don't exist in cache
And the files "File1" and "File2" exist
When I load the plugin
Then should see that "File1" and "File2" are in the cache

Scenario: Successful Synchronization of Deleted Files
Given the files "File1" and "File2" exist in cache
And the files "File1" and "File2" don't exist
When I load the plugin
Then I should see that "File1" and "File2" are not in the cache
